import { SITE_URL, LOCALES, type Locale } from "./i18n";

// Инструкции по брендам камер: как включить ONVIF/RTSP, чтобы камера
// заработала с oko. Контент лежит здесь (не в paraglide): это длинные
// статьи, а не интерфейсные строки. Каждая правка — в обе локали сразу.
//
// Честность формулировок: пункты меню зависят от версии приложения и
// прошивки, поэтому каждая статья несёт оговорку об этом в caveats.

export type GuideContent = {
  title: string;
  metaTitle: string;
  metaDesc: string;
  intro: string;
  steps: string[];
  rtsp: Array<{ label: string; url: string }>;
  creds: string;
  caveats: string[];
};

export type Guide = {
  slug: string;
  brand: string;
  uk: GuideContent;
  en: GuideContent;
  ru: GuideContent;
};

export const GUIDES: Guide[] = [
  {
    slug: "v380-pro",
    brand: "V380 Pro",
    uk: {
      title: "Як увімкнути ONVIF на камері V380 Pro",
      metaTitle: "V380 Pro: увімкнути ONVIF/RTSP — інструкція oko",
      metaDesc:
        "Покрокова інструкція: як у застосунку V380 Pro увімкнути ONVIF, дізнатися RTSP-адресу камери й підключити її до хмарного архіву oko.",
      intro:
        "Камери V380 працюють через власний застосунок, але в більшості прошивок є перемикач ONVIF. Після його ввімкнення камеру бачить bridge oko.",
      steps: [
        "Відкрийте застосунок V380 Pro і переконайтеся, що камера додана й показує живе відео.",
        "Відкрийте налаштування камери (шестерня на картці камери).",
        "Знайдіть пункт «Налаштування ONVIF» (інколи він у розділі «Локальний доступ» або «LAN»). Увімкніть перемикач.",
        "Якщо застосунок пропонує задати пароль ONVIF — задайте і запишіть його: саме він піде в поле «Пароль камери» в oko.",
        "IP-адресу камери подивіться там само в інформації про пристрій або в списку клієнтів вашого роутера.",
        "В oko: Камери → Додати камеру → введіть IP, логін і пароль — bridge підхопить потік сам.",
      ],
      rtsp: [
        { label: "Основний потік", url: "rtsp://IP:8554/live/ch00_0" },
        { label: "Другий потік (економніший)", url: "rtsp://IP:8554/live/ch00_1" },
      ],
      creds: "Типовий логін — admin, пароль порожній або той, що ви задали під час першого налаштування камери.",
      caveats: [
        "Пункти меню відрізняються між версіями застосунку та прошивками. Якщо пункту ONVIF немає взагалі — ваша прошивка його не підтримує, і камера зможе працювати лише через застосунок виробника.",
        "Після ввімкнення ONVIF перезавантажте камеру (вимкніть і ввімкніть живлення).",
      ],
    },
    en: {
      title: "How to enable ONVIF on a V380 Pro camera",
      metaTitle: "V380 Pro: enable ONVIF/RTSP — oko guide",
      metaDesc:
        "Step-by-step: enable ONVIF in the V380 Pro app, find the camera's RTSP address and connect it to the oko cloud archive.",
      intro:
        "V380 cameras live inside their own app, but most firmwares have an ONVIF switch. Once it is on, the oko bridge can see the camera.",
      steps: [
        "Open the V380 Pro app and make sure the camera is added and shows live video.",
        "Open the camera settings (the gear on the camera card).",
        "Find the “ONVIF settings” item (sometimes under “Local access” or “LAN”). Turn the switch on.",
        "If the app offers to set an ONVIF password — set it and write it down: that is what goes into the “Camera password” field in oko.",
        "The camera's IP address is shown in the device info, or in your router's client list.",
        "In oko: Cameras → Add camera → enter the IP, login and password — the bridge picks up the stream itself.",
      ],
      rtsp: [
        { label: "Main stream", url: "rtsp://IP:8554/live/ch00_0" },
        { label: "Sub stream (lighter)", url: "rtsp://IP:8554/live/ch00_1" },
      ],
      creds: "Typical login is admin with an empty password, or the one you set during the camera's first setup.",
      caveats: [
        "Menu items differ between app versions and firmwares. If there is no ONVIF item at all, your firmware does not support it and the camera can only work through the vendor app.",
        "After enabling ONVIF, power-cycle the camera.",
      ],
    },
    ru: {
      title: "Как включить ONVIF на камере V380 Pro",
      metaTitle: "V380 Pro: включить ONVIF/RTSP — инструкция oko",
      metaDesc:
        "Пошаговая инструкция: как в приложении V380 Pro включить ONVIF, узнать RTSP-адрес камеры и подключить её к облачному архиву oko.",
      intro:
        "Камеры V380 работают через собственное приложение, но в большинстве прошивок есть переключатель ONVIF. После его включения камеру видит bridge oko.",
      steps: [
        "Откройте приложение V380 Pro и убедитесь, что камера добавлена и показывает живое видео.",
        "Откройте настройки камеры (шестерёнка на карточке камеры).",
        "Найдите пункт «Настройки ONVIF» (иногда он в разделе «Локальный доступ» или «LAN»). Включите переключатель.",
        "Если приложение предложит задать пароль ONVIF — задайте и запишите его: именно он пойдёт в поле «Пароль камеры» в oko.",
        "IP-адрес камеры смотрите там же в информации об устройстве или в списке клиентов вашего роутера.",
        "В oko: Камеры → Добавить камеру → введите IP, логин и пароль — bridge подхватит поток сам.",
      ],
      rtsp: [
        { label: "Основной поток", url: "rtsp://IP:8554/live/ch00_0" },
        { label: "Второй поток (экономнее)", url: "rtsp://IP:8554/live/ch00_1" },
      ],
      creds: "Типичный логин — admin, пароль пустой или тот, что вы задали при первой настройке камеры.",
      caveats: [
        "Пункты меню отличаются между версиями приложения и прошивками. Если пункта ONVIF нет вообще — ваша прошивка его не поддерживает, и камера сможет работать только через приложение производителя.",
        "После включения ONVIF перезагрузите камеру (выключите и включите питание).",
      ],
    },
  },
  {
    slug: "tp-link-tapo",
    brand: "TP-Link Tapo",
    uk: {
      title: "Як підключити TP-Link Tapo: акаунт камери та RTSP",
      metaTitle: "TP-Link Tapo: акаунт камери, ONVIF/RTSP — інструкція oko",
      metaDesc:
        "Як створити «акаунт камери» в застосунку Tapo, дізнатися RTSP-адресу і підключити камеру до хмарного запису oko.",
      intro:
        "У Tapo ONVIF і RTSP працюють через окремий «акаунт камери», який створюється в застосунку. Це і є логін/пароль для oko.",
      steps: [
        "Відкрийте застосунок Tapo, оберіть камеру.",
        "Натисніть шестерню → «Додаткові налаштування» (Advanced Settings).",
        "Відкрийте «Акаунт камери» (Camera Account) і створіть логін і пароль.",
        "IP-адресу камери видно в налаштуваннях Wi-Fi камери або в списку клієнтів роутера.",
        "В oko: Камери → Додати камеру → IP, логін і пароль з «акаунта камери».",
      ],
      rtsp: [
        { label: "Основний потік (HD)", url: "rtsp://IP:554/stream1" },
        { label: "Другий потік (SD)", url: "rtsp://IP:554/stream2" },
      ],
      creds: "Логін і пароль — ті, що ви створили в «Акаунті камери». Акаунт TP-Link ID тут НЕ підходить.",
      caveats: [
        "Деякі прошивки ховають пункт, поки камера не прив'язана до хмарного акаунта TP-Link.",
        "Батарейні моделі Tapo не тримають постійний RTSP-потік.",
      ],
    },
    en: {
      title: "Connecting TP-Link Tapo: camera account and RTSP",
      metaTitle: "TP-Link Tapo: camera account, ONVIF/RTSP — oko guide",
      metaDesc:
        "How to create a “camera account” in the Tapo app, find the RTSP address and connect the camera to oko cloud recording.",
      intro:
        "On Tapo, ONVIF and RTSP work through a separate “camera account” created in the app. That account is your login/password for oko.",
      steps: [
        "Open the Tapo app and select the camera.",
        "Tap the gear → Advanced Settings.",
        "Open “Camera Account” and create a login and password.",
        "The camera's IP is visible in its Wi-Fi settings or in your router's client list.",
        "In oko: Cameras → Add camera → the IP plus the camera-account login and password.",
      ],
      rtsp: [
        { label: "Main stream (HD)", url: "rtsp://IP:554/stream1" },
        { label: "Sub stream (SD)", url: "rtsp://IP:554/stream2" },
      ],
      creds: "Use the login and password you created in “Camera Account”. Your TP-Link ID does NOT work here.",
      caveats: [
        "Some firmwares hide the item until the camera is linked to a TP-Link cloud account.",
        "Battery-powered Tapo models cannot keep a continuous RTSP stream.",
      ],
    },
    ru: {
      title: "Как подключить TP-Link Tapo: аккаунт камеры и RTSP",
      metaTitle: "TP-Link Tapo: аккаунт камеры, ONVIF/RTSP — инструкция oko",
      metaDesc:
        "Как создать «аккаунт камеры» в приложении Tapo, узнать RTSP-адрес и подключить камеру к облачной записи oko.",
      intro:
        "У Tapo ONVIF и RTSP работают через отдельный «аккаунт камеры», который создаётся в приложении. Это и есть логин/пароль для oko.",
      steps: [
        "Откройте приложение Tapo, выберите камеру.",
        "Нажмите шестерёнку → «Дополнительные настройки» (Advanced Settings).",
        "Откройте «Аккаунт камеры» (Camera Account) и создайте логин и пароль.",
        "IP-адрес камеры виден в настройках Wi-Fi камеры или в списке клиентов роутера.",
        "В oko: Камеры → Добавить камеру → IP, логин и пароль из «аккаунта камеры».",
      ],
      rtsp: [
        { label: "Основной поток (HD)", url: "rtsp://IP:554/stream1" },
        { label: "Второй поток (SD)", url: "rtsp://IP:554/stream2" },
      ],
      creds: "Логин и пароль — те, что вы создали в «Аккаунте камеры». Аккаунт TP-Link ID здесь НЕ подходит.",
      caveats: [
        "Некоторые прошивки прячут пункт, пока камера не привязана к облачному аккаунту TP-Link.",
        "Батарейные модели Tapo не держат постоянный RTSP-поток.",
      ],
    },
  },
  {
    slug: "hikvision",
    brand: "Hikvision",
    uk: {
      title: "Hikvision: увімкнути ONVIF і підключити до oko",
      metaTitle: "Hikvision: ONVIF/RTSP — інструкція oko",
      metaDesc:
        "Як у веб-інтерфейсі Hikvision увімкнути ONVIF (Integration Protocol), створити ONVIF-користувача і підключити камеру до oko.",
      intro:
        "На камерах Hikvision ONVIF типово вимкнений. Вмикається у веб-інтерфейсі камери за дві хвилини.",
      steps: [
        "Відкрийте веб-інтерфейс камери: http://IP-камери у браузері, увійдіть під admin.",
        "Configuration → Network → Advanced Settings → Integration Protocol.",
        "Поставте галочку «Enable ONVIF» (Open Network Video Interface).",
        "Додайте ONVIF-користувача (кнопка Add): рівень — Administrator або Operator. Ці логін/пароль підуть в oko.",
        "Збережіть. В oko: Камери → Додати камеру → IP + ONVIF-користувач.",
      ],
      rtsp: [
        { label: "Основний потік", url: "rtsp://IP:554/Streaming/Channels/101" },
        { label: "Другий потік", url: "rtsp://IP:554/Streaming/Channels/102" },
      ],
      creds:
        "Логін admin і пароль, заданий під час активації камери, або окремий ONVIF-користувач, якщо ви його створили.",
      caveats: [
        "На старих прошивках пункт називається просто ONVIF у Network → Advanced.",
        "Після кількох невдалих спроб пароля камера тимчасово блокує вхід — зачекайте кілька хвилин.",
      ],
    },
    en: {
      title: "Hikvision: enable ONVIF and connect to oko",
      metaTitle: "Hikvision: ONVIF/RTSP — oko guide",
      metaDesc:
        "How to enable ONVIF (Integration Protocol) in the Hikvision web UI, create an ONVIF user and connect the camera to oko.",
      intro: "Hikvision cameras ship with ONVIF disabled. It takes two minutes in the camera's web UI to turn on.",
      steps: [
        "Open the camera's web UI: http://CAMERA-IP in a browser, log in as admin.",
        "Configuration → Network → Advanced Settings → Integration Protocol.",
        "Tick “Enable ONVIF” (Open Network Video Interface).",
        "Add an ONVIF user (Add button): level Administrator or Operator. This login/password goes into oko.",
        "Save. In oko: Cameras → Add camera → the IP plus the ONVIF user.",
      ],
      rtsp: [
        { label: "Main stream", url: "rtsp://IP:554/Streaming/Channels/101" },
        { label: "Sub stream", url: "rtsp://IP:554/Streaming/Channels/102" },
      ],
      creds: "Login admin with the password set at camera activation, or the dedicated ONVIF user if you created one.",
      caveats: [
        "On older firmwares the item is just called ONVIF under Network → Advanced.",
        "Several wrong password attempts lock the camera out temporarily — wait a few minutes.",
      ],
    },
    ru: {
      title: "Hikvision: включить ONVIF и подключить к oko",
      metaTitle: "Hikvision: ONVIF/RTSP — инструкция oko",
      metaDesc:
        "Как в веб-интерфейсе Hikvision включить ONVIF (Integration Protocol), создать ONVIF-пользователя и подключить камеру к oko.",
      intro: "На камерах Hikvision ONVIF по умолчанию выключен. Включается в веб-интерфейсе камеры за две минуты.",
      steps: [
        "Откройте веб-интерфейс камеры: http://IP-камеры в браузере, войдите под admin.",
        "Configuration → Network → Advanced Settings → Integration Protocol.",
        "Поставьте галочку «Enable ONVIF» (Open Network Video Interface).",
        "Добавьте ONVIF-пользователя (кнопка Add): уровень — Administrator или Operator. Эти логин/пароль пойдут в oko.",
        "Сохраните. В oko: Камеры → Добавить камеру → IP + ONVIF-пользователь.",
      ],
      rtsp: [
        { label: "Основной поток", url: "rtsp://IP:554/Streaming/Channels/101" },
        { label: "Второй поток", url: "rtsp://IP:554/Streaming/Channels/102" },
      ],
      creds:
        "Логин admin и пароль, заданный при активации камеры, либо отдельный ONVIF-пользователь, если вы его создали.",
      caveats: [
        "На старых прошивках пункт называется просто ONVIF в Network → Advanced.",
        "После нескольких неверных попыток пароля камера временно блокирует вход — подождите несколько минут.",
      ],
    },
  },
  {
    slug: "dahua",
    brand: "Dahua",
    uk: {
      title: "Dahua: ONVIF і RTSP для підключення до oko",
      metaTitle: "Dahua: ONVIF/RTSP — інструкція oko",
      metaDesc: "Як увімкнути ONVIF на камері Dahua, формат RTSP-посилання і підключення до хмарного архіву oko.",
      intro: "У Dahua ONVIF зазвичай увімкнений, але в нових прошивках авторизація ONVIF окрема від веб-логіна.",
      steps: [
        "Відкрийте веб-інтерфейс камери: http://IP-камери, увійдіть під admin.",
        "Settings → Network → Access Platform (в деяких прошивках — ONVIF).",
        "Переконайтеся, що ONVIF увімкнений; якщо є перемикач «Authentication via ONVIF» — увімкніть.",
        "Логін/пароль для ONVIF — ті самі admin/пароль камери (в нових прошивках можна створити окремого користувача).",
        "В oko: Камери → Додати камеру → IP + логін/пароль.",
      ],
      rtsp: [
        { label: "Основний потік", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=0" },
        { label: "Другий потік", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=1" },
      ],
      creds: "Логін admin і пароль, заданий під час ініціалізації камери.",
      caveats: [
        "Перемарковані камери (Amcrest, EZ-IP тощо) використовують ті самі шляхи RTSP.",
        "Якщо потік не йде — перевірте, що в Access Platform увімкнено саме ONVIF, а не лише P2P.",
      ],
    },
    en: {
      title: "Dahua: ONVIF and RTSP for connecting to oko",
      metaTitle: "Dahua: ONVIF/RTSP — oko guide",
      metaDesc: "How to enable ONVIF on a Dahua camera, the RTSP URL format, and connecting to the oko cloud archive.",
      intro: "Dahua usually ships with ONVIF on, but newer firmwares separate ONVIF authentication from the web login.",
      steps: [
        "Open the camera's web UI: http://CAMERA-IP, log in as admin.",
        "Settings → Network → Access Platform (on some firmwares — ONVIF).",
        "Make sure ONVIF is enabled; if there is an “Authentication via ONVIF” switch, enable it.",
        "ONVIF login/password are the same admin/camera password (newer firmwares let you create a dedicated user).",
        "In oko: Cameras → Add camera → the IP plus login/password.",
      ],
      rtsp: [
        { label: "Main stream", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=0" },
        { label: "Sub stream", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=1" },
      ],
      creds: "Login admin with the password set during camera initialization.",
      caveats: [
        "Rebranded cameras (Amcrest, EZ-IP, etc.) use the same RTSP paths.",
        "If the stream does not start, check that Access Platform enables ONVIF specifically, not just P2P.",
      ],
    },
    ru: {
      title: "Dahua: ONVIF и RTSP для подключения к oko",
      metaTitle: "Dahua: ONVIF/RTSP — инструкция oko",
      metaDesc: "Как включить ONVIF на камере Dahua, формат RTSP-ссылки и подключение к облачному архиву oko.",
      intro: "У Dahua ONVIF обычно включён, но в новых прошивках авторизация ONVIF отдельная от веб-логина.",
      steps: [
        "Откройте веб-интерфейс камеры: http://IP-камеры, войдите под admin.",
        "Settings → Network → Access Platform (в некоторых прошивках — ONVIF).",
        "Убедитесь, что ONVIF включён; если есть переключатель «Authentication via ONVIF» — включите.",
        "Логин/пароль для ONVIF — те же admin/пароль камеры (в новых прошивках можно создать отдельного пользователя).",
        "В oko: Камеры → Добавить камеру → IP + логин/пароль.",
      ],
      rtsp: [
        { label: "Основной поток", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=0" },
        { label: "Второй поток", url: "rtsp://IP:554/cam/realmonitor?channel=1&subtype=1" },
      ],
      creds: "Логин admin и пароль, заданный при инициализации камеры.",
      caveats: [
        "Перемаркированные камеры (Amcrest, EZ-IP и т.п.) используют те же пути RTSP.",
        "Если поток не идёт — проверьте, что в Access Platform включён именно ONVIF, а не только P2P.",
      ],
    },
  },
  {
    slug: "reolink",
    brand: "Reolink",
    uk: {
      title: "Reolink: підключення до oko через RTSP/ONVIF",
      metaTitle: "Reolink: ONVIF/RTSP — інструкція oko",
      metaDesc: "Як перевірити RTSP/ONVIF на камері Reolink і підключити її до хмарного запису oko.",
      intro: "На більшості дротових Reolink RTSP і ONVIF увімкнені з коробки — лишається тільки пароль.",
      steps: [
        "Відкрийте застосунок Reolink або веб-інтерфейс камери.",
        "Налаштування камери → Network → Advanced → Port Settings: переконайтеся, що RTSP і ONVIF увімкнені.",
        "Логін admin, пароль — ваш пароль камери.",
        "В oko: Камери → Додати камеру → IP + admin + пароль.",
      ],
      rtsp: [
        { label: "Основний потік", url: "rtsp://IP:554/h264Preview_01_main" },
        { label: "Другий потік", url: "rtsp://IP:554/h264Preview_01_sub" },
      ],
      creds: "Логін admin і пароль, який ви задали камері при першому налаштуванні.",
      caveats: [
        "Батарейні моделі Reolink (Argus та подібні) не підтримують RTSP взагалі.",
        "На нових моделях основний потік може бути H.265 — якщо браузерний перегляд не йде, оберіть у камері H.264 або підключіть другий потік.",
      ],
    },
    en: {
      title: "Reolink: connecting to oko via RTSP/ONVIF",
      metaTitle: "Reolink: ONVIF/RTSP — oko guide",
      metaDesc: "How to check RTSP/ONVIF on a Reolink camera and connect it to oko cloud recording.",
      intro: "Most wired Reolink cameras ship with RTSP and ONVIF enabled — you only need the password.",
      steps: [
        "Open the Reolink app or the camera's web UI.",
        "Camera settings → Network → Advanced → Port Settings: make sure RTSP and ONVIF are enabled.",
        "Login is admin, the password is your camera password.",
        "In oko: Cameras → Add camera → the IP plus admin and the password.",
      ],
      rtsp: [
        { label: "Main stream", url: "rtsp://IP:554/h264Preview_01_main" },
        { label: "Sub stream", url: "rtsp://IP:554/h264Preview_01_sub" },
      ],
      creds: "Login admin with the password you set at first camera setup.",
      caveats: [
        "Battery Reolink models (Argus and similar) do not support RTSP at all.",
        "Newer models may use H.265 on the main stream — if browser playback fails, switch the camera to H.264 or use the sub stream.",
      ],
    },
    ru: {
      title: "Reolink: подключение к oko через RTSP/ONVIF",
      metaTitle: "Reolink: ONVIF/RTSP — инструкция oko",
      metaDesc: "Как проверить RTSP/ONVIF на камере Reolink и подключить её к облачной записи oko.",
      intro: "На большинстве проводных Reolink RTSP и ONVIF включены из коробки — остаётся только пароль.",
      steps: [
        "Откройте приложение Reolink или веб-интерфейс камеры.",
        "Настройки камеры → Network → Advanced → Port Settings: убедитесь, что RTSP и ONVIF включены.",
        "Логин admin, пароль — ваш пароль камеры.",
        "В oko: Камеры → Добавить камеру → IP + admin + пароль.",
      ],
      rtsp: [
        { label: "Основной поток", url: "rtsp://IP:554/h264Preview_01_main" },
        { label: "Второй поток", url: "rtsp://IP:554/h264Preview_01_sub" },
      ],
      creds: "Логин admin и пароль, который вы задали камере при первой настройке.",
      caveats: [
        "Батарейные модели Reolink (Argus и похожие) не поддерживают RTSP вообще.",
        "На новых моделях основной поток может быть H.265 — если просмотр в браузере не идёт, выберите в камере H.264 или подключите второй поток.",
      ],
    },
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Абсолютный URL страницы гайда в локали. */
export function guideUrl(slug: string | null, locale: Locale): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${SITE_URL}${prefix}/guides${slug ? `/${slug}` : ""}`;
}

/** head() для страниц гайдов: title/description + взаимные hreflang. */
export function guideHead(slug: string | null, locale: Locale, title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: guideUrl(slug, locale) },
      { property: "og:locale", content: locale === "ru" ? "ru_RU" : locale === "uk" ? "uk_UA" : "en_US" },
      { property: "og:image", content: `${SITE_URL}/logo512.png` },
    ],
    links: [
      { rel: "canonical", href: guideUrl(slug, locale) },
      ...LOCALES.map((l) => ({ rel: "alternate", hreflang: l, href: guideUrl(slug, l) })),
      { rel: "alternate", hreflang: "x-default", href: guideUrl(slug, "en") },
    ],
  };
}
