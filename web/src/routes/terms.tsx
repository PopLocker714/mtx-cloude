import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 prose-sm">
      <h1 className="text-2xl font-semibold mb-6">Условия использования</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Регистрируясь в сервисе oko-cloud («Сервис»), вы принимаете настоящие Условия использования и{" "}
          <Link to="/privacy" className="underline">Политику конфиденциальности</Link>.
        </p>
        <h2 className="text-base font-medium text-foreground">1. Сервис</h2>
        <p>
          Сервис предоставляет облачное подключение ваших видеокамер, хранение записей в течение установленного
          периода и доступ к просмотру в реальном времени и к архиву через личный кабинет.
        </p>
        <h2 className="text-base font-medium text-foreground">2. Ваши обязанности</h2>
        <p>
          Вы подключаете только те камеры, на использование которых у вас есть право, и не размещаете съёмку,
          нарушающую права третьих лиц или законодательство. Вы отвечаете за сохранность данных доступа к аккаунту.
        </p>
        <h2 className="text-base font-medium text-foreground">3. Ограничения</h2>
        <p>
          Запрещается использовать Сервис для незаконного наблюдения, а также публиковать потоки в нарушение
          действующих ограничений. Оператор вправе приостановить доступ при нарушении настоящих Условий.
        </p>
        <h2 className="text-base font-medium text-foreground">4. Данные и приватность</h2>
        <p>
          Обработка ваших данных описана в{" "}
          <Link to="/privacy" className="underline">Политике конфиденциальности</Link>, которая является
          неотъемлемой частью настоящих Условий.
        </p>
        <p className="pt-4">
          <Link to="/login" className="underline">← Вернуться ко входу</Link>
        </p>
      </div>
    </article>
  );
}
