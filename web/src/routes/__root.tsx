import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { localeFromPath } from '@/lib/i18n'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // lang выводится из пути, а не из состояния модуля: при SSR два одновременных
  // запроса делят процесс, и «текущий язык» в общей переменной отдал бы одному
  // из них чужое значение. Роутер даёт путь на каждый запрос отдельно.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    // suppressHydrationWarning: next-themes дописывает класс темы на <html>
    // до гидрации (инлайн-скрипт), React не должен на это ругаться.
    <html lang={localeFromPath(pathname)} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
