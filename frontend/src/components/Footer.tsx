export function Footer() {
    return (
        <footer className="mt-auto border-t border-slate-200 bg-white py-8 px-8">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                
                <div className="flex flex-col items-center md:items-start">
                <div className="flex items-center gap-2 mb-2">
                    <div className="bg-slate-900 text-white p-1 rounded">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    </div>
                    <span className="font-bold tracking-tighter text-slate-900 uppercase">
                    ACME BROS <span className="text-blue-600">Pictures</span>
                    </span>
                </div>
                <p className="text-xs text-slate-400">
                    © {new Date().getFullYear()} ACME Studios Inc. Music Licensing Management System.
                </p>
                </div>

                <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">System Operational</span>
                </div>
                <div className="text-slate-300">|</div>
                <span className="text-xs text-slate-400 font-mono">v1.0.0-stable</span>
                </div>
                
            </div>
        </footer>
    )
}