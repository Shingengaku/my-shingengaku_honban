
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

  // 受付ステータス
  const [isActive, setIsActive] = useState(true);

  // 会場マスタ用
  const [venueMaster, setVenueMaster] = useState<{ name: string, type: string }[]>([]);
  const [socialMaster, setSocialMaster] = useState<{ name: string, type: string }[]>([]);

  const [terms, setTerms] = useState<Term[]>([]);

  // 多重選択用の状態管理
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedSocialVenues, setSelectedSocialVenues] = useState<string[]>([]);

  /* ... ポップアップ状態 ... */
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
          if (typeof data.application_active !== 'undefined') {
            setIsActive(data.application_active);
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

    // バリデーション
    // 受講生の場合のみ Term ID 必須
    if (isStudent && !formData.term_id) {
      setError('期を選択してください');
      setLoading(false);
      return;
    }

    // バリデーション: 少なくとも1つは選択する必要があります（「なし」を含む）
    // バリデーション: 会場が選択されている場合、少なくとも1つの懇親会オプションを選択する必要があります
    // 注: ユーザーは懇親会で「なし」を選択できます。
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
      // 通常の会場
      if (checked) {
        newVenues = newVenues.filter(v => v !== 'none' && v !== '参加しない');
        newVenues.push(val);
      } else {
        newVenues = newVenues.filter(v => v !== val);
      }
    }

    // 重複排除
    newVenues = Array.from(new Set(newVenues));
    setSelectedVenues(newVenues);
    setFormData({ ...formData, venue: newVenues.join('・') });

    // 講義会場が変更された場合、懇親会会場をリセットしますか？
    // ユーザーは排他的制御を求めました。
    // 「東京」のチェックを外した場合、「懇親会東京のみ」のチェックも外れるべきです。
    // newVenuesに基づいてselectedSocialVenuesをフィルタリングしましょう。
    // ロジック: 対応する講義会場がまだ選択されている場合のみ、懇親会会場を維持します。
    // または、懇親会で「参加しない」が選択されている場合。

    // 講義で「なし」が選択された場合のみ、懇親会をクリアしますか？
    // または、「東京」が削除された場合、「懇親会東京のみ」を削除します。
    if (newVenues.includes('参加しない') || newVenues.includes('none')) {
      setSelectedSocialVenues(['参加しない']); // 懇親会に「参加しない」を自動選択
    } else {
      // 講義会場が選択されていないすべての懇親会会場を除外します
      // 単純化されたロジック: 懇親会会場名に講義会場名が含まれている場合。
      setSelectedSocialVenues(prev => {
        // 講義会場が選択されている（空でない）場合、懇親会の「参加しない」を強制的に削除しますか？
        // ユーザーのリクエスト: 「講義で『参加しない』をチェックし、その後（講義の）他のオプションをチェックした場合、懇親会の『参加しない』もチェックを外れるべきです。」
        // これは、（「講義なし」ではなく）このブロックにいる場合、自動選択された「懇親会なし」が削除されることを保証する必要があることを意味しますか？
        // 実際には、「講義なし」が選択されていない場合、存在する場合は「懇親会なし」を除外する必要がありますか？
        // 待ってください、ユーザーは「講義: 東京」と「懇親会: なし」を選択したい場合があります。
        // しかしリクエストには次のようにあります: 「講義で『参加しない』がチェックされ、その後私が（講義の）他のオプションをチェックした場合、懇親会の『参加しない』はチェックが外れるべきです。」
        // これは [なし] から [東京] に移行するときに発生します。
        // その場合、`prev` には `['参加しない']` が含まれる可能性があります。
        // ここでそれを除外する必要があります。

        return prev.filter(sv => {
          if (sv === '参加しない' || sv === 'none') return false; // 通常の会場がアクティブな場合、「懇親会なし」を強制的に削除しますか？
          // 待ってください、「東京」と「懇親会なし」を選択したい場合、それができませんか？
          // ユーザーは「他をチェックしたら... 懇親会なしのチェックを外す」と言っています。
          // トランジション時だけでしょうか？
          // しかし `prev` は古い状態です。
          // ここで明示的に '参加しない' を削除する場合、ユーザーが本当にそれを望むなら、再度 '参加しない' を選択させることになります。
          // プロンプトを考慮すると、これの方が安全そうです。
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

        {!isActive ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-center animate-fade-in">
            <div className="flex justify-center mb-2 text-yellow-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-yellow-800 mb-2">ただいま受付を停止しております</h3>
            <p className="text-yellow-700">
              現在、お申込みの受付を一時的に停止しております。<br />
              再開まで今しばらくお待ちください。
            </p>
            <div className="mt-6 pt-6 border-t border-yellow-200">
              <a href="/admin/login" className="text-sm text-yellow-600 hover:text-yellow-800 underline">
                管理者の方はこちら
              </a>
            </div>
          </div>
        ) : (
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
                    {/* マスタが空の場合のフォールバック */}
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
                      // ロジック: この懇親会会場は選択可能ですか？
                      let isDisabled = false;

                      if (selectedVenues.length === 0) {
                        // ケース 1: 会場が選択されていない -> すべて有効
                        isDisabled = false;
                      } else if (selectedVenues.includes('参加しない') && selectedVenues.length === 1) {
                        // ケース 2: 「参加しない」のみ選択 -> 「参加しない」のみ許可
                        isDisabled = s.name !== '参加しません';
                      } else {
                        // ケース 3: 特定の会場が選択されている
                        if (s.name === '参加しません') {
                          isDisabled = false; // 「なし」は常に許可
                        } else {
                          // 対応を確認 (例: 「東京」が選択 -> 「懇親会東京のみ」有効)
                          isDisabled = !selectedVenues.some(lv => s.name.includes(lv));
                        }
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
                    {/* フォールバック */}
                    <label className={`flex items-center ${(selectedVenues.length > 0 && !selectedVenues.includes('東京')) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedSocialVenues.includes('東京懇親会')}
                        disabled={selectedVenues.length > 0 && !selectedVenues.includes('東京')}
                        onChange={(e) => handleSocialChange('東京懇親会', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-gray-700">東京懇親会</span>
                    </label>
                    <label className={`flex items-center ${(selectedVenues.length > 0 && !selectedVenues.includes('福岡')) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedSocialVenues.includes('福岡懇親会')}
                        disabled={selectedVenues.length > 0 && !selectedVenues.includes('福岡')}
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
        )}

        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <a href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600">
            管理者ログイン（開発用）
          </a>
        </div>
      </div>

      {/* お知らせポップアップ */}
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
