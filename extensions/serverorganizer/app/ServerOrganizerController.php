<?php

namespace Pterodactyl\BlueprintFramework\Extensions\serverorganizer;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Pterodactyl\Http\Controllers\Controller;

class ServerOrganizerController extends Controller
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
            'data.sortMode' => ['required', 'string', Rule::in(['manual', 'name', 'status', 'role'])],
            // null = a felhasznalo nem valasztott, a bongeszo nyelve dont.
            'data.language' => ['present', 'nullable', Rule::in(['en', 'hu'])],

            // Lancolt ujrainditas beallitasai.
            'data.chain' => ['present', 'array'],
            'data.chain.stabilitySeconds' => ['required', 'integer', 'min:5', 'max:600'],
            'data.chain.timeoutSeconds' => ['required', 'integer', 'min:30', 'max:3600'],
            'data.chain.startScript' => ['required', 'string', 'max:256'],

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
            'data.servers.*.role' => ['nullable', Rule::in(['primary', 'backup'])],
            'data.servers.*.order' => ['required', 'integer'],
        ]);

        $data = $request->input('data');

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
