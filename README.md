# SolarCharge

PWA do ładowania Tesli Model Y z nadwyżki fotowoltaiki.
Działa na https://kubaosmola-dev.github.io/solarcharge/ — na iPhonie: Safari → Udostępnij → **Do ekranu głównego**.

## Co robi

- **Teraz** — przepływ energii (PV, dom, magazyn, sieć), nadwyżka dla Tesli, stan baterii auta i rekomendacja: ładuj teraz / poczekaj do okna / brak słońca.
- **Automatyka** — sama startuje ładowanie, gdy nadwyżka przekroczy próg, dopasowuje prąd (5–16 A, 3 fazy) i zatrzymuje, gdy słońca brakuje albo cel SOC jest osiągnięty. Działa, gdy aplikacja jest otwarta — dlatego przy starcie ustawia też limit ładowania w aucie na cel SOC, żeby auto zatrzymało się samo, nawet gdy iPhone uśpi aplikację.
- **Plan** — godzinowa prognoza PV na dziś i jutro (Open-Meteo, bez klucza; offline: model bezchmurnego nieba) i okna ładowania z szacowanym zasięgiem.
- **Ustawienia** — cel SOC, próg startu, maks. prąd, pierwszeństwo magazynu domowego, parametry instalacji, dane API.

Tryb **SYM** pokazuje symulację, tryb **LIVE** czyta prawdziwe dane.

## Pliki

```
index.html      cała aplikacja (HTML + CSS + JS, bez zależności)
manifest.json   konfiguracja PWA (ścieżki względne → działa pod /solarcharge/)
sw.js           service worker: offline, powiadomienia
icons/          ikony 192, 512 i apple-touch-icon 180
```

## LIVE — dane API

**Solarman** (falownik Sofar z loggerem Solarman): App ID, App Secret, e-mail i hasło konta. Hasło jest zamieniane na skrót SHA-256 i tylko skrót trafia do pamięci przeglądarki — ale to nim aplikacja loguje się do Solarman, więc trzeba go chronić jak hasło. Station ID aplikacja znajdzie sama.

**Tesla Fleet API**: access token i VIN. Odczyt stanu baterii działa bezpośrednio, ale **komendy (start, stop, prąd) Model Y przyjmuje tylko podpisane** — potrzebny jest oficjalny proxy Tesli [`tesla-http-proxy`](https://github.com/teslamotors/vehicle-command); jego adres wpisuje się w polu „Adres API”.

Jeśli przeglądarka zablokuje zapytania (CORS), aplikacja pokaże to w Ustawieniach — wtedy w polu „Adres API” wpisuje się adres serwera pośredniczącego.

Dane logowania zostają wyłącznie w `localStorage` tej przeglądarki.
