{/* オンライン選択 (参加タイプがオンラインの場合) */ }
{
    participationType === 'online' && (
        <div className="animate-fade-in">
            <span className="block text-sm font-medium text-gray-700 mb-2">
                オンライン視聴タイプ
                <span className="text-red-500 ml-1">*必須</span>
            </span>
            <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                value={selectedOnlineOption}
                onChange={(e) => setSelectedOnlineOption(e.target.value)}
            >
                <option value="">視聴タイプを選択してください</option>
                {onlineOptions.length > 0 ? (
                    onlineOptions.map((opt) => (
                        <option key={opt.name} value={opt.name}>
                            {opt.name}
                        </option>
                    ))
                ) : null}
            </select>
            {onlineOptions.length === 0 && (
                <p className="text-gray-500 text-sm mt-1">現在選択可能なオンラインオプションはありません。</p>
            )}
        </div>
    )
}
