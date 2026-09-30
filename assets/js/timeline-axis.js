/* ==========================================================================
   时间轴 · 一维刻度序列（timeline-axis.js）
   --------------------------------------------------------------------------
   把**图谱**（window.MATH_TREE）摊平成一根轴上的格子序列：一格一个知识点（或一节 / 一章），
   外加六级"段"（分段 / 年级 / 册 / 章 / 节 / 知识点）—— 段边界就是刻度的位置。

   为什么单独一个文件：**2D 的 timeline.js 与 3D 的 timeline-3d.js 用的是同一根轴**
   （用户 2026-09-30 定的"3D 与平面是同一份数据、同一套刻度"）。放在谁那儿都不合适，
   于是抽出来做一份，两边都读它 —— 摊平规则只有一处，不会一边改了另一边不跟。

   入口：`window.WK_AXIS.build()` → { items, segs, total }
     · items  每个格子：{ name, kind, stage, chain, i, x }（chain 是它的六级祖先链）
     · segs   六级段数组，段 = { depth, name, start, end, stage }
     · total  各级计数（接数据体检用）
   ========================================================================== */

(function () {
  'use strict';

  var STAGE_CN = { primary: '小学', junior: '初中', senior: '高中', olympiad: '竞赛' };

  /* 册名 → 年级。文字层级是「分段 → 年级 → 册 → 章 → 节 → 知识点」（用户 2026-09-29 定的顺序），
     而图谱里没有"年级"这一层，得从册名推：一年级上册 → 一年级；必修第一册 → 高一……
     竞赛那四支没有年级（一条 track 直接当"册"那一级），推不出来就是空，空的那一级不生成段。 */
  function gradeOf(bookName) {
    var m = /^([一二三四五六七八九]年级)/.exec(bookName);
    if (m) { return m[1]; }
    if (bookName.indexOf('选择性必修') === 0) { return '高二'; }
    if (bookName.indexOf('必修') === 0) { return '高一'; }
    return '';
  }

  function nameAt(chain, depth) {
    for (var i = 0; i < chain.length; i += 1) {
      if (chain[i].depth === depth) { return chain[i].name; }
    }
    return '';
  }

  function buildAxis() {
    var root = window.MATH_TREE;
    var items = [];
    var total = { book: 0, chapter: 0, section: 0, point: 0 };
    if (!root || !root.children) {
      return { items: items, segs: [[], [], [], [], [], []], total: total };
    }

    function stageOf(chain) {
      for (var i = chain.length - 1; i >= 0; i -= 1) {
        if (chain[i].stage) { return chain[i].stage; }
      }
      return '';
    }

    function walk(node, chain) {
      var kind = node.kind;
      var next = chain;
      if (kind === 'book') {
        total.book += 1;
        var grade = gradeOf(node.name);
        next = chain.concat([{ depth: 0, stage: node.stage, name: STAGE_CN[node.stage] || '数学' }]);
        if (grade) { next = next.concat([{ depth: 1, stage: node.stage, name: grade }]); }
        next = next.concat([{ depth: 2, stage: node.stage, name: node.name }]);
      } else if (kind === 'track') {
        /* 竞赛没有"册"，也没有年级：一条 track（板块）直接落在"册"那一级（depth 2） */
        next = chain.concat([{ depth: 0, stage: 'olympiad', name: STAGE_CN.olympiad },
                             { depth: 2, stage: 'olympiad', name: node.name }]);
      } else if (kind === 'chapter') {
        total.chapter += 1;
        next = chain.concat([{ depth: 3, name: node.name }]);
      } else if (kind === 'section') {
        total.section += 1;
        next = chain.concat([{ depth: 4, name: node.name }]);
      } else if (kind === 'point') {
        total.point += 1;
      }
      /* 方法速学 / 易错速析 / 考点（group / method / error / exam）不上轴：
         它们是知识点卡片里的料，不是学习路径上的一格。 */

      var kids = node.children || [];
      var finer = kids.filter(function (k) { return k.kind === 'section' || k.kind === 'point'; });
      if (kind === 'point') {
        items.push({ name: node.name, kind: 'point', stage: stageOf(next), chain: next });
      } else if (kind === 'section') {
        /* 一节底下有知识点，就让位给知识点；没有，节自己就是一格 */
        if (!kids.some(function (k) { return k.kind === 'point'; })) {
          items.push({ name: node.name, kind: 'section', stage: stageOf(next), chain: next });
        }
      } else if (kind === 'chapter') {
        /* 竞赛那四支的章**底下没有节**（只有章名），这种章本身就是最细的一格 ——
           不认这一步，整个竞赛段就会从轴上消失。 */
        if (!finer.length) {
          items.push({ name: node.name, kind: 'chapter', stage: stageOf(next), chain: next });
        }
      }
      kids.forEach(function (k) { walk(k, next); });
    }

    walk(root, []);

    /* 一格占一个世界单位，中心在 i + 0.5 */
    items.forEach(function (it, i) { it.i = i; it.x = i + 0.5; });

    /* 逐级求"段"：把相邻且同名祖先的格子合成一段（段边界就是刻度的位置） */
    var segs = [[], [], [], [], [], []];
    for (var d = 0; d <= 5; d += 1) {
      (function (depth) {
        var list = segs[depth];
        items.forEach(function (it, i) {
          /* 第 5 级是"知识点"：只有 kind=point 的格子自己算一段（节那一级不重复占） */
          var name = depth === 5 ? (it.kind === 'point' ? it.name : '') : nameAt(it.chain, depth);
          if (!name) { return; }
          var last = list[list.length - 1];
          if (last && last.name === name) { last.end = i + 1; return; }
          list.push({ depth: depth, name: name, start: i, end: i + 1, stage: it.stage });
        });
      }(d));
    }
    return { items: items, segs: segs, total: total };
  }

  window.WK_AXIS = {
    build: buildAxis,
    nameAt: nameAt,
    stageCN: STAGE_CN
  };
}());
