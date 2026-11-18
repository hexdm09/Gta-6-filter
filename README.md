# GTA6 Filter

![afraid of spoilers? this extension is for you](docs/banner.png)

[English](README.en.md)

GTA6 Filter скрывает явно связанный с GTA 6 контент в настольных Chrome, Edge и Firefox. Фильтр работает на YouTube, Reddit и X, в том числе в лентах, поиске и на прямых страницах видео и постов.

Автор проекта — [@hexdm09](https://github.com/hexdm09).

## Установка

### Firefox 140+

1. [Скачайте ZIP для Firefox](https://github.com/hexdm09/Gta-6-filter/releases/latest/download/gta6-filter-firefox.zip).
2. Введите `about:debugging#/runtime/this-firefox` в адресной строке Firefox.
3. Нажмите **Загрузить временное дополнение** и выберите скачанный ZIP целиком.

Временное дополнение работает до перезапуска Firefox. Для постоянной установки нужна сборка с подписью Mozilla.

### Chrome и Edge

1. [Скачайте ZIP для Chrome и Edge](https://github.com/hexdm09/Gta-6-filter/releases/latest/download/gta6-filter-chromium.zip) и распакуйте его.
2. Откройте `chrome://extensions` в Chrome или `edge://extensions` в Edge. Включите **Режим разработчика**.
3. Нажмите **Загрузить распакованное расширение** и выберите папку с `manifest.json`.

После установки обновите открытые вкладки YouTube, Reddit и X. Настройки доступны через иконку GTA6 Filter на панели расширений.

## Защита

Расширение закрывает запись целиком, если её название, текст, доступные подписи, тег или тематическое сообщество указывают на GTA 6. Это включает обычные новости и трейлеры. **Показать один раз** открывает запись до обновления страницы или перехода к другой записи. Через настройки можно выключить защиту на отдельной площадке и добавить свои слова и фразы, по одной на строку.

При открытии прямой ссылки страница закрыта, пока фильтр проверяет запись. Если данных мало, появляется кнопка ручного показа. Смена разметки сайта, картинки без подписей, звук и косвенные намёки могут обходить правила распознавания. Настройки и обработка публикаций остаются на устройстве.

## Сборка из исходников

Нужны Node.js 24 или новее, npm и Python 3 для создания ZIP.

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run package
```

Команда упаковки создаёт `dist/gta6-filter-chromium.zip` и `dist/gta6-filter-firefox.zip`. Для локальной загрузки также можно использовать папки `dist/chromium` и `dist/firefox`.
