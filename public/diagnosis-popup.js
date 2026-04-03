(function() {
  'use strict';

  // ===== CONFIG =====
  const API_URL = 'https://lcjmall.com/api/trpc/adForm.submitDiagnosis';
  const POPUP_DELAY = 8000; // 8秒後に表示
  const STORAGE_KEY = 'lcj_diagnosis_dismissed';

  // ===== DIAGNOSIS LOGIC =====
  function getDiagnosisResult(q1, q2, q3) {
    let score = 0;

    // Q1: ジャンル別スコア
    const genreScores = {
      'コスメ・美容': 5, 'サプリ・健康食品': 4, 'ファッション': 4,
      '食品・グルメ': 3, 'ガジェット・家電': 3, '日用品・雑貨': 2, 'その他': 2
    };
    score += genreScores[q1] || 2;

    // Q2: 武器別スコア
    const strengthScores = {
      'SNS映え・ビジュアル': 5, 'ストーリー・こだわり': 4, '圧倒的コスパ': 4,
      '品質・成分': 3, '正直わからない…': 1
    };
    score += strengthScores[q2] || 2;

    // Q3: TikTokレベル別スコア
    const levelScores = {
      'Lv.0 まだ何もしていない': 2, 'Lv.1 アカウントはある': 3,
      'Lv.2 投稿はしている': 4, 'Lv.3 ライブもやってみた': 4,
      'Lv.4 TikTok Shopで販売中': 5
    };
    score += levelScores[q3] || 2;

    if (score >= 12) {
      return {
        rank: '★★★★★',
        title: '爆売れポテンシャル',
        emoji: '🔥',
        color: '#ff0050',
        comment: 'この商品、ライブで"化け"ます。',
        detail: '正しいライバー選定と演出設計で、TikTok Shopでの爆発的な売上が見込めます。LCJが手がけた同ジャンル商品では、初月から月商300万円を超えた事例もあります。'
      };
    } else if (score >= 8) {
      return {
        rank: '★★★★',
        title: '高ポテンシャル',
        emoji: '✨',
        color: '#ff6b00',
        comment: '面白い商品ですね。ただ、このままだと"もったいない"。',
        detail: '商品力はあるのに、売り方で損をしている典型パターンです。LCJなら、ライブでの見せ方・価格設計・ライバーとのマッチングを最適化して、ポテンシャルを最大限引き出します。'
      };
    } else {
      return {
        rank: '★★★',
        title: '伸びしろMAX',
        emoji: '💪',
        color: '#00c9ff',
        comment: '正直、伸びしろしかない。',
        detail: '今の状態からでも、戦略次第で大きく化ける可能性があります。LCJが手がけた類似商品は、商品ページの改善とライバー選定だけで売上が5倍になった事例もあります。'
      };
    }
  }

  // ===== STYLES =====
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');

      #lcj-diagnosis-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999998;
        background: linear-gradient(135deg, #ff0050 0%, #ff6b00 100%);
        color: #fff;
        border: none;
        border-radius: 60px;
        padding: 14px 28px;
        font-family: 'Noto Sans JP', sans-serif;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(255, 0, 80, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: lcj-fab-pulse 2s infinite;
      }
      #lcj-diagnosis-fab:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 8px 32px rgba(255, 0, 80, 0.5);
      }
      @keyframes lcj-fab-pulse {
        0%, 100% { box-shadow: 0 4px 24px rgba(255, 0, 80, 0.4); }
        50% { box-shadow: 0 4px 32px rgba(255, 0, 80, 0.6), 0 0 0 8px rgba(255, 0, 80, 0.1); }
      }

      #lcj-diagnosis-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        font-family: 'Noto Sans JP', sans-serif;
      }
      #lcj-diagnosis-overlay.lcj-visible {
        opacity: 1;
      }

      #lcj-diagnosis-modal {
        background: #0d0d1a;
        border-radius: 20px;
        width: 90%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        transform: translateY(20px) scale(0.95);
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      #lcj-diagnosis-overlay.lcj-visible #lcj-diagnosis-modal {
        transform: translateY(0) scale(1);
      }

      .lcj-d-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: rgba(255,255,255,0.1);
        border: none;
        color: #fff;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        z-index: 10;
      }
      .lcj-d-close:hover {
        background: rgba(255,255,255,0.2);
      }

      .lcj-d-header {
        padding: 40px 32px 24px;
        text-align: center;
        background: linear-gradient(180deg, rgba(255, 0, 80, 0.15) 0%, transparent 100%);
        border-radius: 20px 20px 0 0;
      }
      .lcj-d-header-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 0, 80, 0.2);
        border: 1px solid rgba(255, 0, 80, 0.3);
        color: #ff4d7d;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 16px;
        letter-spacing: 0.5px;
      }
      .lcj-d-header h2 {
        color: #fff;
        font-size: 22px;
        font-weight: 900;
        line-height: 1.4;
        margin: 0 0 8px;
      }
      .lcj-d-header h2 span {
        background: linear-gradient(135deg, #ff0050, #ff6b00);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .lcj-d-header p {
        color: rgba(255,255,255,0.6);
        font-size: 13px;
        margin: 0;
      }

      .lcj-d-body {
        padding: 0 32px 32px;
      }

      .lcj-d-progress {
        display: flex;
        gap: 6px;
        margin-bottom: 24px;
      }
      .lcj-d-progress-bar {
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: rgba(255,255,255,0.1);
        overflow: hidden;
      }
      .lcj-d-progress-bar.lcj-active {
        background: linear-gradient(90deg, #ff0050, #ff6b00);
      }
      .lcj-d-progress-bar.lcj-done {
        background: #00c9ff;
      }

      .lcj-d-step-label {
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .lcj-d-question {
        color: #fff;
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 20px;
        line-height: 1.5;
      }

      .lcj-d-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .lcj-d-option {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 14px 18px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lcj-d-option:hover {
        background: rgba(255, 0, 80, 0.1);
        border-color: rgba(255, 0, 80, 0.3);
        transform: translateX(4px);
      }
      .lcj-d-option .lcj-d-emoji {
        font-size: 20px;
        flex-shrink: 0;
      }

      .lcj-d-form-group {
        margin-bottom: 16px;
      }
      .lcj-d-form-group label {
        display: block;
        color: rgba(255,255,255,0.7);
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 6px;
      }
      .lcj-d-form-group label .lcj-required {
        color: #ff0050;
        margin-left: 4px;
      }
      .lcj-d-form-group input {
        width: 100%;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        padding: 12px 16px;
        color: #fff;
        font-size: 14px;
        font-family: 'Noto Sans JP', sans-serif;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .lcj-d-form-group input:focus {
        border-color: #ff0050;
      }
      .lcj-d-form-group input::placeholder {
        color: rgba(255,255,255,0.3);
      }

      .lcj-d-submit-btn {
        width: 100%;
        background: linear-gradient(135deg, #ff0050 0%, #ff6b00 100%);
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 16px;
        font-size: 16px;
        font-weight: 700;
        font-family: 'Noto Sans JP', sans-serif;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 8px;
      }
      .lcj-d-submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(255, 0, 80, 0.4);
      }
      .lcj-d-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .lcj-d-result {
        text-align: center;
      }
      .lcj-d-result-rank {
        font-size: 36px;
        margin-bottom: 4px;
      }
      .lcj-d-result-stars {
        font-size: 24px;
        letter-spacing: 4px;
        margin-bottom: 8px;
      }
      .lcj-d-result-title {
        font-size: 28px;
        font-weight: 900;
        margin-bottom: 16px;
      }
      .lcj-d-result-comment {
        font-size: 16px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 12px;
        line-height: 1.6;
      }
      .lcj-d-result-detail {
        font-size: 14px;
        color: rgba(255,255,255,0.7);
        line-height: 1.7;
        margin-bottom: 24px;
        text-align: left;
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 16px;
      }
      .lcj-d-result-cta {
        width: 100%;
        background: linear-gradient(135deg, #ff0050 0%, #ff6b00 100%);
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 18px;
        font-size: 17px;
        font-weight: 700;
        font-family: 'Noto Sans JP', sans-serif;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        animation: lcj-cta-glow 2s infinite;
      }
      .lcj-d-result-cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(255, 0, 80, 0.5);
      }
      @keyframes lcj-cta-glow {
        0%, 100% { box-shadow: 0 4px 20px rgba(255, 0, 80, 0.3); }
        50% { box-shadow: 0 4px 30px rgba(255, 0, 80, 0.5), 0 0 0 4px rgba(255, 0, 80, 0.1); }
      }

      .lcj-d-complete {
        text-align: center;
        padding: 20px 0;
      }
      .lcj-d-complete-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
      .lcj-d-complete h3 {
        color: #fff;
        font-size: 22px;
        font-weight: 900;
        margin: 0 0 12px;
      }
      .lcj-d-complete p {
        color: rgba(255,255,255,0.7);
        font-size: 14px;
        line-height: 1.7;
        margin: 0 0 8px;
      }
      .lcj-d-complete-highlight {
        background: rgba(0, 201, 255, 0.1);
        border: 1px solid rgba(0, 201, 255, 0.2);
        border-radius: 12px;
        padding: 16px;
        margin-top: 20px;
      }
      .lcj-d-complete-highlight p {
        color: #00c9ff;
        font-weight: 700;
        font-size: 15px;
      }

      .lcj-d-limit {
        text-align: center;
        margin-top: 16px;
        color: rgba(255,255,255,0.4);
        font-size: 12px;
      }
      .lcj-d-limit span {
        color: #ff0050;
        font-weight: 700;
      }

      /* slide animation */
      .lcj-slide-enter {
        animation: lcj-slide-in 0.3s ease forwards;
      }
      @keyframes lcj-slide-in {
        from { opacity: 0; transform: translateX(30px); }
        to { opacity: 1; transform: translateX(0); }
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        #lcj-diagnosis-modal {
          width: 95%;
          border-radius: 16px;
        }
        .lcj-d-header {
          padding: 32px 20px 20px;
        }
        .lcj-d-header h2 {
          font-size: 19px;
        }
        .lcj-d-body {
          padding: 0 20px 24px;
        }
        #lcj-diagnosis-fab {
          bottom: 16px;
          right: 16px;
          padding: 12px 20px;
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ===== QUESTIONS DATA =====
  const questions = [
    {
      step: 'Q1',
      label: 'STEP 1 / 3',
      question: 'あなたの商品ジャンルは？',
      options: [
        { emoji: '💄', text: 'コスメ・美容' },
        { emoji: '💊', text: 'サプリ・健康食品' },
        { emoji: '👗', text: 'ファッション' },
        { emoji: '🍜', text: '食品・グルメ' },
        { emoji: '📱', text: 'ガジェット・家電' },
        { emoji: '🏠', text: '日用品・雑貨' },
        { emoji: '✨', text: 'その他' },
      ]
    },
    {
      step: 'Q2',
      label: 'STEP 2 / 3',
      question: 'ぶっちゃけ、あなたの商品の\n"一番の武器"は？',
      options: [
        { emoji: '📸', text: 'SNS映え・ビジュアル' },
        { emoji: '📖', text: 'ストーリー・こだわり' },
        { emoji: '💰', text: '圧倒的コスパ' },
        { emoji: '🔬', text: '品質・成分' },
        { emoji: '🤔', text: '正直わからない…' },
      ]
    },
    {
      step: 'Q3',
      label: 'STEP 3 / 3',
      question: '今のTikTok活用レベルは？',
      options: [
        { emoji: '🌱', text: 'Lv.0 まだ何もしていない' },
        { emoji: '🌿', text: 'Lv.1 アカウントはある' },
        { emoji: '🌳', text: 'Lv.2 投稿はしている' },
        { emoji: '🔥', text: 'Lv.3 ライブもやってみた' },
        { emoji: '🚀', text: 'Lv.4 TikTok Shopで販売中' },
      ]
    }
  ];

  // ===== STATE =====
  let state = {
    step: 0, // 0=intro, 1-3=questions, 4=contact, 5=result, 6=complete
    answers: {},
    contactInfo: {},
    result: null,
  };

  // ===== RENDER =====
  function renderContent() {
    const body = document.getElementById('lcj-d-body');
    if (!body) return;

    if (state.step === 0) {
      body.innerHTML = renderIntro();
    } else if (state.step >= 1 && state.step <= 3) {
      body.innerHTML = renderQuestion(state.step - 1);
    } else if (state.step === 4) {
      body.innerHTML = renderContactForm();
    } else if (state.step === 5) {
      body.innerHTML = renderResult();
    } else if (state.step === 6) {
      body.innerHTML = renderComplete();
    }
  }

  function renderProgressBar() {
    const total = 5; // intro(skip) + 3 questions + contact
    const current = state.step;
    let html = '<div class="lcj-d-progress">';
    for (let i = 1; i <= total; i++) {
      const cls = i < current ? 'lcj-done' : i === current ? 'lcj-active' : '';
      html += '<div class="lcj-d-progress-bar ' + cls + '"></div>';
    }
    html += '</div>';
    return html;
  }

  function renderIntro() {
    return `
      <div class="lcj-slide-enter" style="text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">🎯</div>
        <p style="color:rgba(255,255,255,0.8); font-size:15px; line-height:1.7; margin-bottom:24px;">
          たった<span style="color:#ff0050; font-weight:900;">3問・15秒</span>で<br>
          あなたの商品の<br>
          <span style="font-size:18px; font-weight:900; color:#fff;">ライブコマース爆売れ度</span><br>
          がわかります。
        </p>
        <button class="lcj-d-submit-btn" onclick="window._lcjDiagnosis.nextStep()">
          今すぐ診断スタート →
        </button>
        <div class="lcj-d-limit">
          <span>月間30社限定</span> ・ 完全無料
        </div>
      </div>
    `;
  }

  function renderQuestion(index) {
    const q = questions[index];
    let html = renderProgressBar();
    html += '<div class="lcj-slide-enter">';
    html += '<div class="lcj-d-step-label">' + q.label + '</div>';
    html += '<div class="lcj-d-question">' + q.question.replace(/\n/g, '<br>') + '</div>';
    html += '<div class="lcj-d-options">';
    q.options.forEach(function(opt) {
      html += '<button class="lcj-d-option" onclick="window._lcjDiagnosis.selectOption(\'' + opt.text.replace(/'/g, "\\'") + '\')">';
      html += '<span class="lcj-d-emoji">' + opt.emoji + '</span>';
      html += '<span>' + opt.text + '</span>';
      html += '</button>';
    });
    html += '</div></div>';
    return html;
  }

  function renderContactForm() {
    let html = renderProgressBar();
    html += '<div class="lcj-slide-enter">';
    html += '<div class="lcj-d-step-label">あと少し！</div>';
    html += '<div class="lcj-d-question">診断結果をお届けするために<br>連絡先を教えてください 📋</div>';

    html += '<div class="lcj-d-form-group"><label>お名前<span class="lcj-required">*</span></label>';
    html += '<input type="text" id="lcj-d-name" placeholder="例: 田中太郎"></div>';

    html += '<div class="lcj-d-form-group"><label>会社名<span class="lcj-required">*</span></label>';
    html += '<input type="text" id="lcj-d-company" placeholder="例: 株式会社○○"></div>';

    html += '<div class="lcj-d-form-group"><label>電話番号<span class="lcj-required">*</span></label>';
    html += '<input type="tel" id="lcj-d-phone" placeholder="例: 090-1234-5678"></div>';

    html += '<div class="lcj-d-form-group"><label>メールアドレス<span class="lcj-required">*</span></label>';
    html += '<input type="email" id="lcj-d-email" placeholder="例: tanaka@example.com"></div>';

    html += '<div class="lcj-d-form-group"><label>商品URL or 商品名（任意）</label>';
    html += '<input type="text" id="lcj-d-product" placeholder="例: https://example.com/product"></div>';

    html += '<button class="lcj-d-submit-btn" onclick="window._lcjDiagnosis.submitContact()">';
    html += '🔓 診断結果を見る →</button>';

    html += '<p style="color:rgba(255,255,255,0.3); font-size:11px; text-align:center; margin-top:12px;">';
    html += '※ 入力情報は診断結果のご連絡にのみ使用します</p>';

    html += '</div>';
    return html;
  }

  function renderResult() {
    const r = state.result;
    let html = '<div class="lcj-slide-enter lcj-d-result">';
    html += '<div class="lcj-d-result-rank">' + r.emoji + '</div>';
    html += '<div class="lcj-d-result-stars" style="color:' + r.color + ';">' + r.rank + '</div>';
    html += '<div class="lcj-d-result-title" style="color:' + r.color + ';">' + r.title + '</div>';
    html += '<div class="lcj-d-result-comment">' + r.comment + '</div>';
    html += '<div class="lcj-d-result-detail">' + r.detail + '</div>';
    html += '<button class="lcj-d-result-cta" onclick="window._lcjDiagnosis.requestStrategy()">';
    html += '無料で詳しい戦略を聞く →</button>';
    html += '</div>';
    return html;
  }

  function renderComplete() {
    let html = '<div class="lcj-slide-enter lcj-d-complete">';
    html += '<div class="lcj-d-complete-icon">🎉</div>';
    html += '<h3>送信完了！</h3>';
    html += '<p>' + (state.contactInfo.name || '') + ' 様、ありがとうございます。</p>';
    html += '<div class="lcj-d-complete-highlight">';
    html += '<p>📞 担当者から24時間以内にご連絡します</p>';
    html += '</div>';
    html += '<p style="margin-top:16px;">TikTok Shop売上No.1の実績をもとに、<br>御社の商品に最適な戦略をご提案します。</p>';
    html += '<button class="lcj-d-submit-btn" style="margin-top:20px;" onclick="window._lcjDiagnosis.close()">閉じる</button>';
    html += '</div>';
    return html;
  }

  // ===== ACTIONS =====
  window._lcjDiagnosis = {
    open: function() {
      const overlay = document.getElementById('lcj-diagnosis-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(function() { overlay.classList.add('lcj-visible'); }, 10);
      }
      // Hide FAB
      const fab = document.getElementById('lcj-diagnosis-fab');
      if (fab) fab.style.display = 'none';
    },
    close: function() {
      const overlay = document.getElementById('lcj-diagnosis-overlay');
      if (overlay) {
        overlay.classList.remove('lcj-visible');
        setTimeout(function() { overlay.style.display = 'none'; }, 300);
      }
      // Show FAB
      const fab = document.getElementById('lcj-diagnosis-fab');
      if (fab) fab.style.display = 'flex';
      // Remember dismissal for this session
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
    },
    nextStep: function() {
      state.step = 1;
      renderContent();
    },
    selectOption: function(text) {
      if (state.step === 1) state.answers.q1 = text;
      else if (state.step === 2) state.answers.q2 = text;
      else if (state.step === 3) state.answers.q3 = text;

      if (state.step < 3) {
        state.step++;
        renderContent();
      } else {
        // Go to contact form
        state.step = 4;
        renderContent();
      }
    },
    submitContact: function() {
      var name = document.getElementById('lcj-d-name').value.trim();
      var company = document.getElementById('lcj-d-company').value.trim();
      var phone = document.getElementById('lcj-d-phone').value.trim();
      var email = document.getElementById('lcj-d-email').value.trim();
      var product = document.getElementById('lcj-d-product').value.trim();

      if (!name || !company || !phone || !email) {
        alert('必須項目を入力してください');
        return;
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        alert('正しいメールアドレスを入力してください');
        return;
      }

      state.contactInfo = { name: name, company: company, phone: phone, email: email, product: product };
      state.result = getDiagnosisResult(state.answers.q1, state.answers.q2, state.answers.q3);
      state.step = 5;
      renderContent();
    },
    requestStrategy: function() {
      // Send to API
      var btn = document.querySelector('.lcj-d-result-cta');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '送信中...';
      }

      var payload = {
        contactPerson: state.contactInfo.name,
        companyName: state.contactInfo.company,
        phone: state.contactInfo.phone,
        email: state.contactInfo.email,
        productUrl: state.contactInfo.product || undefined,
        q1Genre: state.answers.q1,
        q2Strength: state.answers.q2,
        q3TiktokLevel: state.answers.q3,
        diagnosisResult: state.result.title,
      };

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: payload }),
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        state.step = 6;
        renderContent();
      })
      .catch(function(err) {
        console.error('[LCJ Diagnosis] API Error:', err);
        // Still show complete screen
        state.step = 6;
        renderContent();
      });
    }
  };

  // ===== INIT =====
  function init() {
    injectStyles();

    // Create FAB button
    var fab = document.createElement('button');
    fab.id = 'lcj-diagnosis-fab';
    fab.innerHTML = '🔥 無料診断する';
    fab.onclick = function() { window._lcjDiagnosis.open(); };
    fab.style.display = 'none'; // Hidden initially
    document.body.appendChild(fab);

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'lcj-diagnosis-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div id="lcj-diagnosis-modal">
        <button class="lcj-d-close" onclick="window._lcjDiagnosis.close()">✕</button>
        <div class="lcj-d-header">
          <div class="lcj-d-header-badge">⚡ TikTok Shop 売上No.1</div>
          <h2>あなたの商品、<br>ライブで<span>いくら売れる？</span></h2>
          <p>日本一売ってる事務所が、無料で辛口診断</p>
        </div>
        <div class="lcj-d-body" id="lcj-d-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Render initial content
    renderContent();

    // Auto-show after delay (only once per session)
    var dismissed = false;
    try { dismissed = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch(e) {}

    if (!dismissed) {
      setTimeout(function() {
        window._lcjDiagnosis.open();
      }, POPUP_DELAY);
    } else {
      // Show FAB for returning users
      fab.style.display = 'flex';
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
