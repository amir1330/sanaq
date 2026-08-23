# Cloudflare: coffee.abuyunus.cc

В Cloudflare → **abuyunus.cc** → DNS → Add record:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `coffee` | `89.167.79.221` | Proxied (оранжевое облако) |

SSL/TLS → Overview: **Full (strict)** — как у `gym.abuyunus.cc`.

На origin уже есть Cloudflare Origin CA на `*.abuyunus.cc`, Traefik его подхватит.
