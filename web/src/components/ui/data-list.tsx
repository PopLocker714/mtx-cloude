import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Одни и те же данные двумя раскладками: таблица на sm+ и карточки на телефоне.
//
// Таблица на 390px либо сжимает колонки до нечитаемых, либо уезжает за край
// карточки — поэтому на мобиле каждая строка становится карточкой «подпись → значение»,
// а колонка действий уходит вниз отдельным рядом.

export type Column<T> = {
  /** Стабильный ключ колонки. */
  key: string;
  /** Заголовок колонки; он же подпись поля в мобильной карточке. */
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Колонка действий: прижимается вправо в таблице, отдельным рядом в карточке. */
  actions?: boolean;
  /** Заглавное поле карточки — показывается крупно и без подписи. */
  primary?: boolean;
  className?: string;
};

export function DataList<T>({
  rows,
  columns,
  rowKey,
  empty,
}: {
  rows: T[] | null;
  columns: Column<T>[];
  rowKey: (row: T, i: number) => string;
  empty: React.ReactNode;
}) {
  if (rows && rows.length === 0) {
    return <div className="px-6 py-8 text-center text-muted-foreground">{empty}</div>;
  }

  return (
    <>
      {/* Мобильная раскладка */}
      <ul className="divide-y sm:hidden">
        {rows?.map((row, i) => {
          const primary = columns.find((c) => c.primary);
          const actions = columns.filter((c) => c.actions);
          const fields = columns.filter((c) => !c.actions && !c.primary);
          return (
            <li key={rowKey(row, i)} className="space-y-2 px-4 py-4">
              {primary && <div className="font-medium break-all">{primary.cell(row)}</div>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {fields.map((c) => (
                  <React.Fragment key={c.key}>
                    <dt className="text-muted-foreground">{c.header}</dt>
                    <dd className="min-w-0 break-words text-right">{c.cell(row)}</dd>
                  </React.Fragment>
                ))}
              </dl>
              {actions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">{actions.map((c) => <React.Fragment key={c.key}>{c.cell(row)}</React.Fragment>)}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Табличная раскладка */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.actions ? "text-right" : undefined}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((row, i) => (
              <TableRow key={rowKey(row, i)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={[c.className, c.actions ? "space-x-2 text-right" : ""].filter(Boolean).join(" ")}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
