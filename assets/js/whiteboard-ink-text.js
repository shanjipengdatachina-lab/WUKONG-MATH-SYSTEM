/* ==========================================================================
   数字白板 —— 「手写转文字」的识别与点评（预置数据）
   --------------------------------------------------------------------------
   本版**不接真 AI**（与「分析 / 答案」同一处理方式）：识别结果与每步点评都是预置的。
   接入真服务时，只需要把下面的 recognize() / review() 换成两次网络调用
   （先把手写图识别成文字，再让模型按步点评），界面层（whiteboard.js）完全不动。

   两条硬规矩：
   1. **只认题面框以外的笔迹**。题面上的笔迹多半是"圈已知条件"，
      混进去会把识别结果带脏 —— 判定规则见 outsideStrokes()。
   2. 预置的是"一道题的参考解法"，不是用户真写的那段字。
      所以界面上必须带「演示」标记，而且**题面外一笔都没有时不装** ——
      凭空变出一段用户没写过的字，比不做更糟。
   ========================================================================== */
window.WK_INK_TEXT = (function () {
  'use strict';

  /* 一条笔迹的采样点**过半**落在题面框外，才算"你写的思路"。
     工具种类不参与判断：荧光笔画在框外也算你写的。
     正好一半算"框内"（严格过半才收），宁可少收，也别把圈注混进来。 */
  function outsideStrokes(strokes, box) {
    if (!box || !(box.w > 0) || !(box.h > 0)) return [];
    var out = [];
    (strokes || []).forEach(function (s) {
      var pts = (s && s.points) || [];
      if (!pts.length) return;
      var outside = 0;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (p.x < box.x || p.x > box.x + box.w || p.y < box.y || p.y > box.y + box.h) outside++;
      }
      if (outside * 2 > pts.length) out.push(s);
    });
    return out;
  }

  /* 预置的"参考思路"。只给演示题库里那几道最简单的题（与「答案」预置同一批）。
     点评刻意只写两类：**成立** 与 **可以更严谨**（写法 / 习惯层面）。
     预置数据里不编"这一步错了" —— 没有真模型就不该判学生对错。 */
  var PRESET = {
    '7a-01': [
      { text: '先看符号：一正一负 → 异号相加', tone: 'ok', comment: '动手前先把类型判出来，这个习惯很好，比直接算错得少。' },
      { text: '|−7| = 7，|3| = 3，7 > 3', tone: 'ok', comment: '比绝对值。这一步不必写这么细，写了也不会错。' },
      { text: '= −(7 − 3) = −4', tone: 'careful', comment: '两个等号挤在一行。建议拆开写：先把负号定下来，再算 7 − 3，中间结果留在纸上，回头检查时一眼能看出来。' }
    ],
    '7a-02': [
      { text: '6 − (−4)', tone: 'ok', comment: '先把原式抄下来。' },
      { text: '= 6 + 4', tone: 'careful', comment: '减去一个负数等于加上它的相反数 —— 括号里那个负号最容易漏。这一步建议单独占一行，别和下一步挤在一起。' },
      { text: '= 10', tone: 'ok', comment: '把减法统一成加法之后再算，结果正确。' }
    ],
    '7a-03': [
      { text: '同号相乘得正', tone: 'ok', comment: '先定符号再算数，顺序对。' },
      { text: '2 × 5 = 10', tone: 'ok', comment: '绝对值相乘，答案 10，没问题。' }
    ],
    '7a-04': [
      { text: '异号相除得负', tone: 'ok', comment: '先把符号定下来，对的。' },
      { text: '18 ÷ 6 = 3', tone: 'ok', comment: '绝对值相除。' },
      { text: '= −3', tone: 'careful', comment: '最后补负号这一步别省 —— 除法题里丢了负号是最常见的丢分点，写完回看一眼符号。' }
    ],
    '7a-13': [
      { text: '3x + 5 = 11', tone: 'ok', comment: '先写原方程。' },
      { text: '3x = 11 − 5', tone: 'careful', comment: '移项要变号。写成"11 − 5"不算错；但更稳的写法是两边同时减 5，一眼能看出为什么变号。' },
      { text: '3x = 6，x = 2', tone: 'ok', comment: '系数化 1，两边同时除以 3。结果正确。' }
    ]
  };

  /* 语气标：只有这三种取值。界面按它上色，也是断言要守的东西 */
  var TONES = ['ok', 'careful', 'warn'];
  var TONE_LABEL = { ok: '成立', careful: '可以更严谨', warn: '这一步有问题' };

  /* 没预置时怎么说 —— 要老实，不编 */
  var NO_PRESET = '这道题还没有演示数据。接入在线模型后，这里会是你自己写的那一段。';
  var DEMO_NOTE = '识别与每步点评由本机演示数据生成，尚未接入在线模型。';

  /* ------------------------------------------------------------------
     下面两个函数就是"将来换掉的那两个"。
     真服务版：recognize() 把手写图送去 OCR；review() 把识别出的文字送去点评。
     ------------------------------------------------------------------ */

  /* 识别：把手写笔迹转成分步骤的文字。返回 { ok, steps: [{ text }] } */
  function recognize(problemId, strokes) {
    var out = (strokes || []).length;
    var preset = PRESET[problemId];
    if (!preset) return { ok: false, reason: out ? 'no-preset' : 'empty' };
    return {
      ok: true,
      source: 'preset',
      steps: preset.map(function (row) { return { text: row.text }; })
    };
  }

  /* 点评：给第 index 步一条评价。返回 { ok, tone, comment }。
     真服务版会用第三步参数 text（学生实际写的那句）而不是预置的那句。 */
  function review(problemId, index, text) {
    var preset = PRESET[problemId];
    var row = preset && preset[index];
    if (!row) return { ok: false, tone: 'ok', comment: '' };
    return { ok: true, tone: row.tone, comment: row.comment };
  }

  function has(problemId) { return !!PRESET[problemId]; }

  return {
    outsideStrokes: outsideStrokes,
    recognize: recognize,
    review: review,
    has: has,
    TONES: TONES,
    TONE_LABEL: TONE_LABEL,
    NO_PRESET: NO_PRESET,
    DEMO_NOTE: DEMO_NOTE,
    PRESET: PRESET
  };
})();
