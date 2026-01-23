type GridField<T> = {
  label: string
  render: (item: T) => React.ReactNode
}

type GridProps<T> = {
  items: T[]
  fields: GridField<T>[]
  getKey: (item: T) => React.Key
}

export function Grid<T>({
  items,
  fields,
  getKey,
}: GridProps<T>) {
    return (
        <div className="bg-white shadow-sm border border-slate-200 overflow-hidden rounded-lg">
            <table className="w-full text-left border-collapse border-separate">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        {fields.map((field) => (
                            <th
                                key={field.label}
                                className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase"
                            >
                                {field.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                        <tr
                            className={`hover:bg-slate-50/50 transition-colors`}
                            key={getKey(item)}
                        >
                            {fields.map((field) => (
                                <td key={field.label} className="px-6 py-4 text-sm text-slate-600">
                                    {field.render(item)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}