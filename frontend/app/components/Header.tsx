'use client';

interface HeaderProps {
  activeTab: 'dashboard' | 'movies' | 'songs' | 'tracks';
  onTabChange: (tab: 'dashboard' | 'movies' | 'songs' | 'tracks') => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'movies', label: 'Movies' },
    { key: 'songs', label: 'Songs' },
    { key: 'tracks', label: 'Tracks' },
  ] as const;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-gray-900">ACME Bros Pictures</span>
          </div>
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`${
                  activeTab === tab.key
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                } transition-colors`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
