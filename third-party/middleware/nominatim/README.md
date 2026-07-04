# Local Nominatim

Nominatim starts with the default middleware stack. The compose default uses
`mediagis/nominatim:5.3.2`, whose embedded PostgreSQL data directory is mounted
from `data/middleware/nominatim` to `/var/lib/postgresql/16/main`.

The local `.env` uses the China PBF extract for reverse-geocoding tests. Use the
script entrypoint so proxy variables are cleared consistently.

Example:

```sh
third-party/middleware/nominatim/scripts/import-region.sh china
```

Use `monaco` for a small rebuild test, or pass a full `.osm.pbf` URL. Set
`NOMINATIM_RESET_DATA=1` to remove `data/middleware/nominatim` before starting a
fresh import.

After the import is ready, set the application reverse geocoding endpoint:

```env
NUXT_NOMINATIM_BASE_URL=http://nominatim:8080
```
