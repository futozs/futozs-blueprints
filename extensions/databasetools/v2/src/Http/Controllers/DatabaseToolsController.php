<?php

namespace FutoZs\DatabaseTools\Http\Controllers;

use Exception;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use PDO;
use Pterodactyl\Enum\Permissions;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Exceptions\Http\HttpForbiddenException;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Facades\Hashids;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Database;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Adatbazis import / export / urites / meret - az 1.x-es panelbe epitett
 * ImportExportController 2.x-es megfeleloje, azonos viselkedessel.
 *
 * A route-ok a szerverhez kotott kliens API stack mogott vannak: a {database}
 * a szerverhez tartozik (ResourceBelongsToServer), a jogosultsag pedig - ahogy
 * 1.x-en is - a 'database.view_password'.
 */
class DatabaseToolsController extends Controller
{
    public function __construct(private readonly Encrypter $encrypter) {}

    /** Az osszes adatbazis merete egy lekeressel: { "<hashid>": "12.5 MB" }. */
    public function sizes(Request $request, Server $server): array
    {
        $this->authorizeTools($request, $server);

        $sizes = [];
        foreach ($server->databases()->with('host')->get()->groupBy('database_host_id') as $databases) {
            $names = $databases->pluck('database')->all();

            try {
                $conn = $this->connectHost($databases->first());
                $placeholders = implode(',', array_fill(0, count($names), '?'));
                $stmt = $conn->prepare("SELECT table_schema AS name, SUM(data_length + index_length) / 1024 / 1024 AS size
                    FROM information_schema.TABLES WHERE table_schema IN ($placeholders) GROUP BY table_schema");
                $stmt->execute($names);
                $found = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            } catch (Exception $exception) {
                Log::error('Error calculating database size: '.$exception->getMessage());
                $found = [];
            }

            foreach ($databases as $database) {
                $sizes[Hashids::encode($database->id)] = $this->formatSize($found[$database->database] ?? null);
            }
        }

        return ['data' => $sizes];
    }

    public function export(Request $request, Server $server, Database $database): BinaryFileResponse
    {
        $this->authorizeTools($request, $server);
        set_time_limit(300);

        try {
            $tmpDir = storage_path('app/database-export');
            if (! is_dir($tmpDir)) {
                mkdir($tmpDir, 0755, true);
            }

            $conn = $this->connect($database);
            $tmpFile = sprintf('%s/%s-%s.sql', $tmpDir, $database->database, time());
            $file = fopen($tmpFile, 'w');

            fwrite($file, "-- Pterodactyl Database Export\n");
            fwrite($file, '-- Server: '.$database->host->host."\n");
            fwrite($file, '-- Database: '.$database->database."\n");
            fwrite($file, '-- Generated: '.date('Y-m-d H:i:s')."\n\n");

            foreach ($this->tables($conn) as $table) {
                $row = $conn->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
                fwrite($file, "DROP TABLE IF EXISTS `$table`;\n");
                fwrite($file, $row[1].";\n\n");

                $this->eachInsert($conn, $table, fn (string $sql) => fwrite($file, $sql.";\n"));
                fwrite($file, "\n");
            }

            fclose($file);

            Activity::event('server:database.export')
                ->subject($database)
                ->property('name', $database->database)
                ->log();

            return response()->download($tmpFile, $database->database.'.sql')->deleteFileAfterSend(true);
        } catch (Exception $exception) {
            throw new DisplayException($exception->getMessage());
        }
    }

    public function import(Request $request, Server $server, Database $database): array
    {
        $this->authorizeTools($request, $server);
        $request->validate([
            'truncate' => 'sometimes|string|in:0,1',
            'database_file' => 'required|file|mimes:sql,txt|max:50000',
        ]);
        set_time_limit(300);

        try {
            $content = file_get_contents($request->file('database_file')->getRealPath());

            $conn = $this->connect($database);
            if ($request->input('truncate') === '1') {
                $this->dropAll($conn);
            }

            $conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, 0);
            $conn->exec($content);

            Activity::event('server:database.import')
                ->subject($database)
                ->property('name', $database->database)
                ->property('size', strlen($content))
                ->log();

            return ['success' => true];
        } catch (Exception $exception) {
            throw new DisplayException($exception->getMessage());
        }
    }

    public function importRemote(Request $request, Server $server, Database $database): array
    {
        $this->authorizeTools($request, $server);
        $data = $request->validate([
            'truncate' => 'sometimes|string|in:0,1',
            'host' => 'required|string',
            'port' => 'required|string',
            'database' => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string',
        ]);
        set_time_limit(300);

        try {
            $remote = new PDO(
                sprintf('mysql:host=%s;port=%s;dbname=%s', $data['host'], $data['port'], $data['database']),
                $data['username'],
                $data['password'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );

            $local = $this->connect($database);
            if (($data['truncate'] ?? '0') === '1') {
                $this->dropAll($local);
            }

            foreach ($this->tables($remote) as $table) {
                $row = $remote->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
                $local->exec($row[1]);

                $this->eachInsert($remote, $table, fn (string $sql) => $local->exec($sql));
            }

            Activity::event('server:database.import-remote')
                ->subject($database)
                ->property('name', $database->database)
                ->property('remote_host', $data['host'])
                ->log();

            return ['success' => true];
        } catch (Exception $exception) {
            throw new DisplayException($exception->getMessage());
        }
    }

    public function clear(Request $request, Server $server, Database $database): array
    {
        $this->authorizeTools($request, $server);
        set_time_limit(300);

        try {
            $this->dropAll($this->connect($database));

            Activity::event('server:database.clear')
                ->subject($database)
                ->property('name', $database->database)
                ->log();

            return ['success' => true];
        } catch (Exception $exception) {
            throw new DisplayException($exception->getMessage());
        }
    }

    private function authorizeTools(Request $request, Server $server): void
    {
        if ($request->user()->cannot(Permissions::DatabaseViewPassword->value, $server)) {
            throw new HttpForbiddenException('You do not have permission to manage the databases of this server.');
        }
    }

    /**
     * A database host hitelesitoivel csatlakozunk: a szerverenkenti felhasznalo
     * altalaban a szerver tavoli cimere (pl. 172.18.%) van korlatozva, a panelrol nem eri el.
     */
    private function connect(Database $database): PDO
    {
        $host = $database->host;

        return new PDO(
            sprintf('mysql:host=%s;port=%s;dbname=%s', $host->host, $host->port, $database->database),
            $host->username,
            $this->encrypter->decrypt($host->password),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    }

    private function connectHost(Database $database): PDO
    {
        $host = $database->host;

        return new PDO(
            sprintf('mysql:host=%s;port=%s', $host->host, $host->port),
            $host->username,
            $this->encrypter->decrypt($host->password),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    }

    /** @return list<string> */
    private function tables(PDO $conn): array
    {
        return $conn->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    }

    private function dropAll(PDO $conn): void
    {
        $conn->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($this->tables($conn) as $table) {
            $conn->exec("DROP TABLE IF EXISTS `$table`");
        }
        $conn->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    /** Soronkent egy INSERT, a forras kapcsolat idezojelezesevel. */
    private function eachInsert(PDO $conn, string $table, callable $emit): void
    {
        $stmt = $conn->query("SELECT * FROM `$table`");
        $columns = $stmt->columnCount();

        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $values = [];
            for ($i = 0; $i < $columns; $i++) {
                $values[] = match (true) {
                    $row[$i] === null => 'NULL',
                    is_numeric($row[$i]) => $row[$i],
                    default => $conn->quote($row[$i]),
                };
            }

            $emit("INSERT INTO `$table` VALUES (".implode(', ', $values).')');
        }
    }

    private function formatSize(mixed $sizeInMB): string
    {
        if ($sizeInMB === null) {
            return '0 B';
        }

        $sizeInMB = (float) $sizeInMB;

        return match (true) {
            $sizeInMB < 0.01 => '< 0.01 MB',
            $sizeInMB < 1 => round($sizeInMB * 1024, 2).' KB',
            $sizeInMB < 1024 => round($sizeInMB, 2).' MB',
            default => round($sizeInMB / 1024, 2).' GB',
        };
    }
}
