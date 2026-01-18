
'use client';

import { useState, useEffect } from 'react';

/* ... imports ... */

interface Term {
  id: number;
  name: string;
}

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    furigana: '',
    email: '',
    venue: '',
    term_id: '',
  });

  // 新規追加: 受講生かどうか、紹介者情報
  const [isStudent, setIsStudent] = useState(true);
  const [introducer, setIntroducer] = useState('');
  const [noIntroducer, setNoIntroducer] = useState(false);

  // 会場マスタ用
  const [venueMaster, setVenueMaster] = useState<{ name: string, type: string }[]>([]);
  const [socialMaster, setSocialMaster] = useState<{ name: string, type: string }[]>([]);

  const [terms, setTerms] = useState<Term[]>([]);

  // 多重選択用の状態管理
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedSocialVenues, setSelectedSocialVenues] = useState<string[]>([]);

  /* ... popup state ... */
  const [infoText, setInfoText] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, termsRes, venuesRes] = await Promise.all([
          fetch('/api/settings', { cache: 'no-store' }),
          fetch('/api/terms', { cache: 'no-store' }),
          fetch('/api/venues', { cache: 'no-store' })
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data.application_text) {
            setInfoText(data.application_text);
          }
        }
        if (termsRes.ok) {
          setTerms(await termsRes.json());
        }
        if (venuesRes.ok) {
          const vData = await venuesRes.json();
          setVenueMaster(vData.filter((v: any) => v.type === 'lecture'));
          setSocialMaster(vData.filter((v: any) => v.type === 'social'));
        }
      } catch (e) {
        console.error('Failed to load settings or terms');
      }
    };
    fetchSettings();
  }, []);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    // 受講生の場合のみ Term ID 必須
    if (isStudent && !formData.term_id) {
      setError('期を選択してください');
      setLoading(false);
      return;
    }

    // Validation: at least one must be selected (including none)
    // Validation: at least one social option must be selected if venues are selected
    // Note: User can select "None" for social.
    if (selectedSocialVenues.length === 0) {
      setError('懇親会の参加有無（または「参加しません」）を選択してください');
      setLoading(false);
      return;
    }

    const finalSocialVenue = selectedSocialVenues.join('・');
    const finalVenue = selectedVenues.join('・');

    try {
      const payload = {
        ...formData,
        venue: finalVenue,
        social_venue: finalSocialVenue,
        introducer: !isStudent ? introducer : undefined,
        no_introducer: !isStudent ? noIntroducer : undefined,
        // 一般の場合は term_id を空にする
        term_id: isStudent ? formData.term_id : undefined,
      };

      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || '送信に失敗しました');
        throw new Error(errorMsg);
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleVenueChange = (val: string, checked: boolean) => {
    let newVenues = [...selectedVenues];
    const isNone = val === 'none' || val === '参加しない';

    if (isNone) {
      if (checked) {
        newVenues = ['参加しない'];
      } else {
        newVenues = [];
      }
    } else {
      // Normal venue
      if (checked) {
        newVenues = newVenues.filter(v => v !== 'none' && v !== '参加しない');
        newVenues.push(val);
      } else {
        newVenues = newVenues.filter(v => v !== val);
      }
    }

    // De-dupe
    newVenues = Array.from(new Set(newVenues));
    setSelectedVenues(newVenues);
    setFormData({ ...formData, venue: newVenues.join('・') });

    // Reset Social Venues if Lecture Venues change?
    // User asked for exclusive control.
    // If I uncheck "Tokyo", "Tokyo Social" should be unchecked.
    // Let's filter selectedSocialVenues based on newVenues.
    // Logic: Keep social venue ONLY if its corresponding lecture venue is still selected.
    // or if "Participate None" is selected for social.

    // Only if none is selected for lecture, clear social?
    // Or if "Tokyo" removed, remove "Tokyo Social".
    if (newVenues.includes('参加しない') || newVenues.includes('none')) {
      setSelectedSocialVenues(['参加しない']); // Auto select "None" for social?
    } else {
      // Filter out social venues that don't match any selected lecture venue
      // Simplified logic: If social venue name contains lecture venue name.
      setSelectedSocialVenues(prev => {
        // If Lecture Venue is selected (not empty), force remove "Participate None" from Social?
        // User request: "When checking other options (Lecture) while 'None' is checked, clear 'Social None' too."
        // This implies if we are in this block (not "Lecture None"), we should ensure "Social None" is removed if it was auto-selected?
        // Actually, if "Lecture None" is NOT selected, we should filter out "Social None" if it exists?
        // Wait, user might want to select "Lecture: Tokyo" and "Social: None".
        // But the request says: "When 'Participate None' (Lecture) is checked, and then I check other options (Lecture), 'Participate None' (Social) should be unchecked."
        // This happens when transitioning from [None] to [Tokyo].
        // In that case, `prev` might contain `['参加しない']`.
        // We should filter it out here.

        return prev.filter(sv => {
          if (sv === '参加しない' || sv === 'none') return false; // Force remove "Social None" when normal venues are active?
          // Wait, if I want to select "Tokyo" and "Social None", I can't?
          // The user says "When I check others... uncheck Social None".
          // Maybe just when transitions?
          // But `prev` is the old state.
          // If I explicitly remove '参加しない' here, I force the user to re-select '参加しない' if they really want it.
          // Given the prompt, this seems safer.
          return newVenues.some(lv => sv.includes(lv));
        });
      });
    }
  };

  const handleSocialChange = (val: string, checked: boolean) => {
    let newSocials = [...selectedSocialVenues];
    const isNone = val === 'none' || val === '参加しない';

    if (isNone) {
      if (checked) {
        newSocials = ['参加しない'];
      } else {
        newSocials = newSocials.filter(v => v !== '参加しない');
      }
    } else {
      if (checked) {
        newSocials = newSocials.filter(v => v !== '参加しない' && v !== 'none');
        newSocials.push(val);
      } else {
        newSocials = newSocials.filter(v => v !== val);
      }
    }
    setSelectedSocialVenues(newSocials);
  };

  /* ... sent view ... */
  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4 text-green-600">受付完了</h2>
          <p className="text-gray-700 mb-6">
            お申込みありがとうございます。<br />
            ご登録のメールアドレス宛に決済リンクまたは受付完了メールを送信しましたので、ご確認ください。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-500 hover:underline"
          >
            入力画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-8">
          神言学 集中講座 お申込み
        </h1>

        {infoText && (
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="px-6 py-2 bg-yellow-500 text-white font-bold rounded-full hover:bg-yellow-600 shadow-md transition-transform transform hover:scale-105"
            >
              集中講座詳細はこちら
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 受講生・一般 選択 */}
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              属性
              <span className="text-red-500 ml-1">*必須</span>
            </span>
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="userType"
                  value="student"
                  checked={isStudent}
                  onChange={() => setIsStudent(true)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">受講生</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="userType"
                  value="general"
                  checked={!isStudent}
                  onChange={() => {
                    setIsStudent(false);
                    setFormData({ ...formData, term_id: '' }); // Reset term when switching to general
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">一般（受講生ではない）</span>
              </label>
            </div>
          </div>

          <div className={!isStudent ? 'opacity-50 pointer-events-none' : ''}>
            <label htmlFor="term" className="block text-sm font-medium text-gray-700">
              期
              {isStudent && <span className="text-red-500 ml-1">*必須</span>}
            </label>
            <select
              id="term"
              required={isStudent}
              disabled={!isStudent}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border disabled:bg-gray-100"
              value={formData.term_id}
              onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
            >
              <option value="">期を選択してください</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">※ご自身の期を選択してください。選択された期と名前に基づいて情報を確認します。</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              ご参加者様のお名前
              <span className="text-red-500 ml-1">*必須</span>
            </label>
            <input
              type="text"
              id="name"
              required
              placeholder="神言 太郎"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="furigana" className="block text-sm font-medium text-gray-700">
              ふりがな
              <span className="text-red-500 ml-1">*必須</span>
            </label>
            <input
              type="text"
              id="furigana"
              required
              placeholder="しんげん たろう"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              value={formData.furigana}
              onChange={(e) => setFormData({ ...formData, furigana: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
              <span className="text-red-500 ml-1">*必須</span>
            </label>
            <input
              type="email"
              id="email"
              required
              placeholder="example@email.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <p className="text-sm text-red-500 mt-1 font-bold">
              ※入力されたアドレスに決済リンクが送信されます
            </p>
          </div>

          {/* 紹介者情報 (一般のみ) */}
          {!isStudent && (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 animate-fade-in">
              <label htmlFor="introducer" className="block text-sm font-medium text-gray-700">
                ご紹介者様
              </label>
              <p className="text-xs text-gray-500 mb-2">
                ※ご紹介により参加される方は、ご紹介者様のお名前をご記入ください。
              </p>
              <div className="mt-2">
                <input
                  type="text"
                  id="introducer"
                  disabled={noIntroducer}
                  placeholder="紹介者のお名前"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border disabled:bg-gray-100 disabled:text-gray-400"
                  value={introducer}
                  onChange={(e) => setIntroducer(e.target.value)}
                />
              </div>
              <div className="mt-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={noIntroducer}
                    onChange={(e) => {
                      setNoIntroducer(e.target.checked);
                      if (e.target.checked) setIntroducer('');
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">紹介者はいない（不明）</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              参加会場
              <span className="text-red-500 ml-1">*必須</span>
            </span>
            <div className="space-y-2">
              {venueMaster.length > 0 ? (
                <>
                  {venueMaster.map((v) => (
                    <label key={v.name} className="flex items-center">
                      <input
                        type="checkbox"
                        name="venue"
                        value={v.name}
                        checked={selectedVenues.includes(v.name)}
                        onChange={(e) => handleVenueChange(v.name, e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-gray-700">{v.name}</span>
                    </label>
                  ))}
                </>
              ) : (
                <>
                  {/* Fallback if master is empty */}
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      value="東京"
                      checked={selectedVenues.includes('東京')}
                      onChange={(e) => handleVenueChange('東京', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-gray-700">東京</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      value="福岡"
                      checked={selectedVenues.includes('福岡')}
                      onChange={(e) => handleVenueChange('福岡', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-gray-700">福岡</span>
                  </label>
                </>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  value="参加しない"
                  checked={selectedVenues.includes('参加しない')}
                  onChange={(e) => handleVenueChange('参加しない', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">参加しません</span>
              </label>
              {(selectedVenues.length > 1 && !selectedVenues.includes('参加しない')) && (
                <p className="text-xs text-blue-600 ml-6">※複数会場に参加される場合は、全て選択してください。</p>
              )}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              懇親会
              <span className="text-red-500 ml-1">*必須</span>
            </span>
            <div className="space-y-2 pl-4">
              {socialMaster.length > 0 ? (
                <>
                  {socialMaster.map(s => {
                    // Logic: Is this social venue selectable?
                    // Check if ANY selected lecture venue's name matches this social venue
                    // "Tokyo Social" should be enabled if "Tokyo" Lecture is selected.
                    // Assuming name inclusion logic: "Tokyo" in "Tokyo"

                    let isDisabled = true;
                    if (selectedVenues.includes('参加しない') || selectedVenues.length === 0) {
                      isDisabled = true;
                    } else {
                      // Check match
                      // If s.name contains any of selectedVenues? or vice versa?
                      // Product Master logic: "Tokyo" lecture -> "Tokyo Social" allowed.
                      // Ideally exact map, but partial match "Tokyo" in "Tokyo Social".
                      isDisabled = !selectedVenues.some(lv => s.name.includes(lv));
                    }

                    // Force disable if "参加しない" is selected for socials? (Exclusive in handleSocialChange)
                    if (selectedSocialVenues.includes('参加しない') && s.name !== '参加しない') {
                      // Actually, we handle this in onChange, unchecking others. 
                      // But if we want to visually disable/gray out when "None" is checked? 
                      // User requested "Master control only".
                      // Let's just follow standard logic.
                    }

                    return (
                      <label key={s.name} className={`flex items-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedSocialVenues.includes(s.name)}
                          disabled={isDisabled}
                          onChange={(e) => handleSocialChange(s.name, e.target.checked)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-gray-700">{s.name}</span>
                      </label>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Fallback */}
                  <label className={`flex items-center ${(!selectedVenues.includes('東京')) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSocialVenues.includes('東京懇親会')}
                      disabled={!selectedVenues.includes('東京')}
                      onChange={(e) => handleSocialChange('東京懇親会', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-gray-700">東京懇親会</span>
                  </label>
                  <label className={`flex items-center ${(!selectedVenues.includes('福岡')) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSocialVenues.includes('福岡懇親会')}
                      disabled={!selectedVenues.includes('福岡')}
                      onChange={(e) => handleSocialChange('福岡懇親会', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-gray-700">福岡懇親会</span>
                  </label>
                </>
              )}

              <label className={`flex items-center`}>
                <input
                  type="checkbox"
                  value="参加しない"
                  checked={selectedSocialVenues.includes('参加しない')}
                  onChange={(e) => handleSocialChange('参加しない', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">参加しません</span>
              </label>
            </div>

            {(selectedVenues.length === 0) && (
              <p className="text-xs text-red-500 mt-1">※会場を選択してください</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {loading ? '送信中...' : '申し込む'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <a href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600">
            管理者ログイン（開発用）
          </a>
        </div>
      </div>

      {/* Info Popup */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full relative">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl"
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4 text-gray-900">お知らせ</h3>
            <div className="whitespace-pre-wrap text-sm text-gray-600 mb-6 max-h-[60vh] overflow-y-auto">
              {infoText}
            </div>
            <div className="text-center">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-bold"
              >
                確認しました
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
