interface HeaderProps {
  title?: string;
}

export const Header = ({ title = 'Music Licensing' }: HeaderProps) => {
  return (
    <header className="bg-slate-900 text-white shadow-md h-20 flex items-center">
      <div className="w-full mx-auto !px-4 py-4 flex items-center justify-between">
        <h1 className="text-4xl font-bold"><a href="/">{title}</a></h1>
      </div>
    </header>
  );
};
