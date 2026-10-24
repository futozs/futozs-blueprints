<?php

namespace FutoZs\ServerOrganizer\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use FutoZs\ServerOrganizer\Models\ServerOrganizerPreference;
use Pterodactyl\Http\Controllers\Controller;

class PreferenceController extends Controller
{
    /**
     * A tarolt JSON maximalis merete. Bunkosag ellen: kb. 2000 szerver + 100
     * csoport is boven belefer, de egy elszabadult kliens nem tudja tele-irni
     * az adatbazist.
     */
    private const MAX_PAYLOAD_BYTES = 262144; // 256 KB

    /**
     * A bejelentkezett felhasznalo beallitasainak lekerese.
     */
    public function index(Request $request): JsonResponse
    {
        $preference = ServerOrganizerPreference::query()
            ->where('user_id', $request->user()->id)
            ->first();

        return new JsonResponse([
            'data' => $preference->data ?? null,
        ]);
    }

    /**
     * Beallitasok mentese. Teljes dokumentumot varunk (nem reszleges frissitest).
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'data' => ['required', 'array'],
            'data.version' => ['required', 'integer', 'min:1'],
            'data.enabled' => ['required', 'boolean'],
            // A 'role' a 3.x-es kliensektol johet meg - elfogadjuk, a frontend 'manual'-ra alakitja.
            'data.sortMode' => ['required', 'string', Rule::in(['manual', 'name', 'status', 'role'])],
            // null = a felhasznalo nem valasztott, a bongeszo nyelve dont.
            'data.language' => ['present', 'nullable', Rule::in(['en', 'hu'])],

            'data.groups' => ['present', 'array', 'max:100'],
            'data.groups.*.id' => ['required', 'string', 'max:64'],
            'data.groups.*.name' => ['required', 'string', 'max:64'],
            'data.groups.*.color' => ['required', 'string', 'max:32'],
            'data.groups.*.icon' => ['nullable', 'string', 'max:64'],
            'data.groups.*.collapsed' => ['required', 'boolean'],
            'data.groups.*.order' => ['required', 'integer'],

            'data.servers' => ['present', 'array', 'max:2000'],
            'data.servers.*.group' => ['nullable', 'string', 'max:64'],
            'data.servers.*.color' => ['nullable', 'string', 'max:32'],
            'data.servers.*.icon' => ['nullable', 'string', 'max:64'],
            // Csak http/https - igy nem lehet 'javascript:' vagy 'data:' semat becsempeszni.
            'data.servers.*.imageUrl' => ['nullable', 'string', 'max:512', 'regex:/^https?:\/\//i'],
            'data.servers.*.order' => ['required', 'integer'],
        ]);

        $data = $request->input('data');

        // 4.0 ota a szerep a szerver Startup ROLE valtozojabol jon, a lanc beallitasa
        // pedig a .ptero/start.sh dolga - a regi mezoket nem taroljuk tovabb.
        unset($data['chain']);
        foreach ($data['servers'] as $uuid => $server) {
            unset($data['servers'][$uuid]['role']);
        }

        $encoded = json_encode($data);
        if ($encoded === false || strlen($encoded) > self::MAX_PAYLOAD_BYTES) {
            return new JsonResponse([
                'errors' => [[
                    'code' => 'PayloadTooLarge',
                    'detail' => 'A beallitasok merete meghaladja a megengedett 256 KB-ot.',
                ]],
            ], 422);
        }

        ServerOrganizerPreference::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            ['data' => $data],
        );

        return new JsonResponse(['data' => $data]);
    }
}
