# 地图提供器

LumaMemo 支持两种地图提供器，您可以根据需求选择合适的提供器。

| 提供器                | 支持 | 额外配置          | 特性                     |
| --------------------- | :--: | ----------------- | ------------------------ |
| [MapLibre](#maplibre) |  ✅  | MapTiler 访问令牌 | 免费开源，支持自定义样式 |
| [Mapbox](#mapbox)     |  ✅  | Mapbox 访问令牌   | 默认提供器，Standard 样式，支持地球视图 |

## MapLibre

要使用 MapLibre 作为地图提供器，您需要一个 [MapTiler 访问令牌](https://cloud.maptiler.com/account/keys/)。

```bash
NUXT_PUBLIC_MAP_PROVIDER=maplibre
NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN=your_maplibre_access_token
```

### 自定义样式

```bash
# LumaMemo 已经内置了自动切换的浅色和深色两种样式
# 如果配置自定义样式，将会覆盖默认样式
# 示例: https://demotiles.maplibre.org/globe.json
NUXT_PUBLIC_MAP_MAPLIBRE_STYLE=
```

## MapBox

要使用 Mapbox 作为地图提供器，您需要一个 [Mapbox 访问令牌](https://console.mapbox.com/account/access-tokens/)。

```bash
NUXT_PUBLIC_MAP_PROVIDER=mapbox
NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
NUXT_PUBLIC_MAP_MAPBOX_STYLE=mapbox://styles/mapbox/standard
```

### 自定义样式

```bash
# 如果配置自定义样式，将会覆盖默认样式
# 示例: mapbox://styles/mapbox/streets-v12
NUXT_PUBLIC_MAP_MAPBOX_STYLE=mapbox://styles/mapbox/standard
```
