# Cloudflare: sanaq.abuyunus.cc

В Cloudflare → **abuyunus.cc** → DNS:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `sanaq` | `89.167.79.221` | Proxied (оранжевое облако) |

SSL/TLS: **Full (strict)**, Always Use HTTPS, мин. TLS 1.2.

На origin уже есть Cloudflare Origin CA на `*.abuyunus.cc`, Traefik его подхватит.

Старый `coffee.abuyunus.cc` Traefik ещё принимает, если запись вернётся.
