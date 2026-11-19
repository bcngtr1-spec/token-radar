(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var state = {
    q: '',
    category: 'all',
    chain: 'all',
    watchlistOnly: false,
    minTvl: 0,
    sort: 'rank',
    dir: 1, // 1 asc, -1 desc
    selected: null
  };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(0) + 'K';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function sliderToTvl(val) {
    if (val <= 0) return 0;
    if (val >= 100) return 1e9;
    var minLog = Math.log(1e3);
    var maxLog = Math.log(1e9);
    return Math.exp(minLog + (val / 100) * (maxLog - minLog));
  }

  function tvlToSlider(tvl) {
    if (tvl <= 0) return 0;
    if (tvl >= 1e9) return 100;
    var minLog = Math.log(1e3);
    var maxLog = Math.log(1e9);
    return Math.max(0, Math.min(100, ((Math.log(tvl) - minLog) / (maxLog - minLog)) * 100));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === 'true') state.watchlistOnly = true;
    if (params.get('mintvl')) state.minTvl = parseFloat(params.get('mintvl')) || 0;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('dir')) state.dir = parseInt(params.get('dir'), 10) || 1;
    if (params.get('p')) state.selected = params.get('p');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('watchlist', 'true');
    if (state.minTvl > 0) params.set('mintvl', String(state.minTvl));
    if (state.sort !== 'rank') params.set('sort', state.sort);
    if (state.dir !== 1) params.set('dir', String(state.dir));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function getFilteredRows() {
    var q = state.q.trim().toLowerCase();
    var minTvl = state.minTvl;
    return DATA.board.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.watchlistOnly && !r.is_watchlist) return false;
      if (minTvl > 0 && (r.tvl_usd || 0) < minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function getSortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd || 0; bv = b.tvl_usd || 0; }
      else if (key === 'change') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -Infinity : a.age_days; bv = b.age_days === null ? -Infinity : b.age_days; }
      else if (key === 'implied') { av = a.implied_value_usd || 0; bv = b.implied_value_usd || 0; }
      else if (key === 'confidence') { av = a.confidence || 0; bv = b.confidence || 0; }
      else { av = a.rank || 0; bv = b.rank || 0; }

      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return (a.rank || 0) - (b.rank || 0);
    });
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function renderHeader() {
    return el('header', { class: 'top-header' },
      el('h1', { text: 'Pre-Token Radar' }),
      el('div', { style: 'font-size: 13px; color: var(--muted); font-family: var(--font-num);', text: 'Snapshot as of ' + DATA.as_of })
    );
  }

  function renderStatStrip() {
    var totalImplied = DATA.totals && DATA.totals.implied_value_usd ? fmtUsd(DATA.totals.implied_value_usd) : '$0';
    var cov = DATA.coverage || { watchlist_covered: 0, watchlist_total: 40, ranked: DATA.board.length };
    return el('div', { class: 'stat-strip' },
      el('div', { class: 'stat-card' },
        el('div', { class: 'label', text: 'Watchlist covered' }),
        el('div', { class: 'value', text: cov.watchlist_covered + '/' + (cov.watchlist_total || 40) })
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'label', text: 'Ranked pre-token' }),
        el('div', { class: 'value', text: String(cov.ranked || DATA.board.length) })
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'label', text: 'Total implied value' }),
        el('div', { class: 'value', text: totalImplied })
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'label', text: 'Snapshot date' }),
        el('div', { class: 'value', text: DATA.as_of })
      )
    );
  }

  function renderHowItWorks() {
    return el('div', { class: 'how-it-works' },
      'How the model thinks: ',
      el('strong', { text: 'implied value = TVL x category multiple x 7-day growth x maturity x chain reach, derived entirely from the snapshot.' })
    );
  }

  function renderControls() {
    var categories = Array.from(new Set(DATA.board.map(function (r) { return r.category || 'Other'; }))).sort();
    var allChainsSet = new Set();
    DATA.board.forEach(function (r) {
      if (r.chains) r.chains.forEach(function (c) { allChainsSet.add(c); });
    });
    var chains = Array.from(allChainsSet).sort();

    var searchInput = el('input', { type: 'text', id: 'search-input', placeholder: 'Search protocol, category...', value: state.q });
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      writeHash();
      updateTableAndCount();
    });

    var catSelect = el('select', { id: 'category-select' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })
    );
    catSelect.addEventListener('change', function () {
      state.category = catSelect.value;
      writeHash();
      updateTableAndCount();
    });

    var chainSelect = el('select', { id: 'chain-select' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (ch) {
        return el('option', { value: ch, text: ch, selected: ch === state.chain ? 'selected' : null });
      })
    );
    chainSelect.addEventListener('change', function () {
      state.chain = chainSelect.value;
      writeHash();
      updateTableAndCount();
    });

    var watchlistCheckbox = el('input', { type: 'checkbox', id: 'watchlist-checkbox', checked: state.watchlistOnly ? 'checked' : null });
    watchlistCheckbox.addEventListener('change', function () {
      state.watchlistOnly = watchlistCheckbox.checked;
      writeHash();
      updateTableAndCount();
    });

    var sliderVal = tvlToSlider(state.minTvl);
    var tvlSlider = el('input', { type: 'range', id: 'tvl-slider', min: '0', max: '100', step: '1', value: String(sliderVal) });
    var sliderLabel = el('span', { id: 'tvl-slider-val', text: state.minTvl > 0 ? fmtUsd(state.minTvl) : 'Any TVL' });
    
    tvlSlider.addEventListener('input', function () {
      var val = parseFloat(tvlSlider.value);
      var tvl = sliderToTvl(val);
      state.minTvl = val === 0 ? 0 : Math.round(tvl);
      sliderLabel.textContent = state.minTvl > 0 ? fmtUsd(state.minTvl) : 'Any TVL';
      writeHash();
      updateTableAndCount();
    });

    var resetButton = el('button', { class: 'btn', type: 'button', text: 'Reset', onclick: function () {
      state.q = '';
      state.category = 'all';
      state.chain = 'all';
      state.watchlistOnly = false;
      state.minTvl = 0;
      state.sort = 'rank';
      state.dir = 1;
      writeHash();
      renderAll();
    }});

    return el('div', { class: 'controls-panel' },
      el('div', { class: 'control-group' }, el('label', { for: 'search-input', text: 'Search' }), searchInput),
      el('div', { class: 'control-group' }, el('label', { for: 'category-select', text: 'Category' }), catSelect),
      el('div', { class: 'control-group' }, el('label', { for: 'chain-select', text: 'Chain' }), chainSelect),
      el('div', { class: 'control-group' },
        el('span', { text: 'Watchlist' }),
        el('div', { class: 'checkbox-group' },
          watchlistCheckbox,
          el('label', { for: 'watchlist-checkbox', text: 'Watchlist only' })
        )
      ),
      el('div', { class: 'control-group' },
        el('div', { style: 'display: flex; justify-content: space-between;' },
          el('label', { for: 'tvl-slider', text: 'Min TVL' }),
          sliderLabel
        ),
        tvlSlider
      ),
      el('div', { class: 'control-group', style: 'justify-content: flex-end;' },
        resetButton
      )
    );
  }

  function sortHeader(key, label) {
    var active = state.sort === key;
    var arrow = active ? (state.dir > 0 ? ' ▲' : ' ▼') : '';
    return el('th', {
      scope: 'col',
      onclick: function () {
        if (state.sort === key) {
          state.dir = -state.dir;
        } else {
          state.sort = key;
          state.dir = (key === 'rank' || key === 'age' || key === 'name') ? 1 : -1;
        }
        writeHash();
        updateTableAndCount();
      }
    }, label + arrow);
  }

  function renderTableContainer() {
    var container = el('div', { id: 'table-container' });
    updateTableContainerContent(container);
    return container;
  }

  function updateTableAndCount() {
    var container = document.getElementById('table-container');
    if (container) {
      updateTableContainerContent(container);
    }
    var countEl = document.getElementById('results-count');
    if (countEl) {
      var list = getFilteredRows();
      countEl.textContent = list.length + ' protocols shown';
    }
  }

  function updateTableContainerContent(container) {
    container.textContent = '';
    var list = getSortedRows(getFilteredRows());

    if (list.length === 0) {
      container.appendChild(el('div', { class: 'table-panel', style: 'padding: 32px; text-align: center;' },
        el('h3', { style: 'color: var(--text); margin-bottom: 8px;', text: 'No protocols match your filters' }),
        el('p', { style: 'color: var(--muted); margin-bottom: 16px;', text: 'Try adjusting your search query, category, chain, or minimum TVL.' }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Reset filters', onclick: function () {
          state.q = '';
          state.category = 'all';
          state.chain = 'all';
          state.watchlistOnly = false;
          state.minTvl = 0;
          state.sort = 'rank';
          state.dir = 1;
          writeHash();
          renderAll();
        }})
      ));
      return;
    }

    var tbody = el('tbody');
    list.forEach(function (r) {
      var changeClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var changeText = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var chainsHtml = (r.chains || []).slice(0, 3).map(function (c) {
        return el('span', { class: 'chip', text: c });
      });

      var starBadge = r.is_watchlist ? el('span', { class: 'badge-star', title: 'Watchlist protocol', text: '★' }) : null;
      var conf = r.confidence || 0;

      var tr = el('tr', {
        onclick: function () { openDrawer(r.slug); },
        tabindex: '0',
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null,
          el('div', { style: 'display: flex; align-items: center; gap: 4px;' },
            el('b', { text: r.name }),
            starBadge
          ),
          el('div', { style: 'font-size: 11px; color: var(--muted);', text: r.category || 'Other' })
        ),
        el('td', null, el('div', null, chainsHtml)),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + changeClass, text: changeText }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', style: 'font-weight: 600; color: var(--accent);', text: fmtUsd(r.implied_value_usd) }),
        el('td', { class: 'num' },
          el('div', { class: 'mini-bar-container' },
            el('span', { text: String(conf) }),
            el('div', { class: 'mini-bar' },
              el('div', { class: 'mini-bar-fill', style: 'width: ' + Math.max(5, Math.min(100, conf)) + '%;' })
            )
          )
        )
      );
      tbody.appendChild(tr);
    });

    var table = el('table', null,
      el('thead', null,
        el('tr', null,
          sortHeader('rank', 'Rank'),
          sortHeader('name', 'Protocol'),
          el('th', { scope: 'col', text: 'Chains' }),
          sortHeader('tvl', 'TVL'),
          sortHeader('change', '7d %'),
          sortHeader('age', 'Age (d)'),
          sortHeader('implied', 'Implied value'),
          sortHeader('confidence', 'Confidence')
        )
      ),
      tbody
    );

    container.appendChild(el('div', { class: 'table-panel' },
      el('div', { style: 'padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;' },
        el('span', { style: 'font-weight: 600; font-size: 14px;', text: 'Ranked Board' }),
        el('span', { id: 'results-count', style: 'font-size: 12px; color: var(--muted);', text: list.length + ' protocols shown' })
      ),
      el('div', { class: 'table-responsive' }, table)
    ));
  }

  function renderFooter() {
    return el('footer', { class: 'footer' },
      el('p', { text: 'Built from the sealed DefiLlama snapshot - figures frozen, radar deterministic.' })
    );
  }

  // Drawer element setup
  var backdrop = el('div', { class: 'drawer-backdrop', onclick: closeDrawer });
  var drawer = el('div', { class: 'drawer', id: 'detail-drawer' });

  function openDrawer(slug) {
    var row = DATA.board.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();

    drawer.textContent = '';

    var watchlistBadge = row.is_watchlist ? el('span', { class: 'badge', text: 'Watchlist Protocol ★' }) : el('span', { class: 'badge', style: 'background: rgba(156, 163, 175, 0.1); color: var(--muted);', text: 'Pre-Token' });
    var categoryName = row.category || 'Other';
    var baseMult = row.model && row.model.base_multiple !== undefined ? row.model.base_multiple : 0.20;
    var growthMult = row.model && row.model.growth_mult !== undefined ? row.model.growth_mult : 1.0;
    var maturityMult = row.model && row.model.maturity_mult !== undefined ? row.model.maturity_mult : 0.85;
    var chainMult = row.model && row.model.chain_mult !== undefined ? row.model.chain_mult : 1.0;

    var conf = row.confidence || 0;
    var confRationale = 'Confidence score ' + conf + '/100 derived from data presence (' + (row.change_7d !== null ? '+10 7d change' : '') + ', ' + (row.listed_at !== null ? '+10 listed date' : '') + '), TVL scale (' + (row.tvl_usd >= 50e6 ? '+5' : '0') + '), and age penalty (' + (row.age_days < 30 ? '-15' : '0') + ').';

    var farmStepsList = el('ol', { class: 'farm-steps-list' });
    if (row.farm_steps && row.farm_steps.length > 0) {
      row.farm_steps.forEach(function (stepText) {
        farmStepsList.appendChild(el('li', null, el('span', { text: stepText })));
      });
    } else {
      farmStepsList.appendChild(el('li', null, el('span', { text: 'Standard liquidity and interaction farm steps across multi-snapshot duration.' })));
    }

    var riskNotes = [];
    if (row.tvl_usd < DATA.floor_usd * 5) {
      riskNotes.push('Small protocol - airdrop uncertain, TVL may be short-lived.');
    }
    riskNotes.push('Audit status unknown - verify the site domain before signing anything.');

    var riskNotesLi = riskNotes.map(function (note) {
      return el('li', { text: note });
    });

    drawer.appendChild(
      el('div', { class: 'drawer-header' },
        el('div', null,
          el('div', { style: 'display: flex; gap: 8px; align-items: center; margin-bottom: 4px;' },
            el('span', { style: 'font-size: 12px; color: var(--muted); font-family: var(--font-num);', text: 'Rank #' + row.rank }),
            watchlistBadge
          ),
          el('h2', { class: 'drawer-title', text: row.name }),
          el('div', { style: 'font-size: 13px; color: var(--muted);', text: categoryName + ' • ' + (row.chains ? row.chains.join(', ') : 'No chains') })
        ),
        el('button', { class: 'btn', type: 'button', text: '✕ Close', onclick: closeDrawer })
      )
    );

    drawer.appendChild(
      el('div', { class: 'drawer-content' },
        // Implied Value Big section
        el('div', { style: 'background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; text-align: center;' },
          el('div', { style: 'font-size: 12px; color: var(--muted); text-transform: uppercase; margin-bottom: 4px;', text: 'Implied Value' }),
          el('div', { style: 'font-size: 28px; font-weight: 700; color: var(--accent); font-family: var(--font-num);', text: fmtUsd(row.implied_value_usd) }),
          el('div', { style: 'font-size: 12px; color: var(--muted); margin-top: 4px; font-family: var(--font-num);', text: 'Confidence: ' + conf + '/100' }),
          el('p', { style: 'font-size: 12px; color: var(--muted); margin-top: 8px; text-align: left;', text: confRationale })
        ),

        // Model breakdown table
        el('div', null,
          el('div', { class: 'section-title', text: 'Model breakdown' }),
          el('table', { class: 'breakdown-table' },
            el('thead', null,
              el('tr', null,
                el('th', { text: 'Component' }),
                el('th', { class: 'num', text: 'Value / Multiplier' })
              )
            ),
            el('tbody', null,
              el('tr', null, el('td', { text: 'TVL' }), el('td', { class: 'num', text: fmtUsd(row.tvl_usd) })),
              el('tr', null, el('td', { text: 'Category multiple (' + categoryName + ')' }), el('td', { class: 'num', text: baseMult.toFixed(2) })),
              el('tr', null, el('td', { text: 'Growth mult (7d change ' + (row.change_7d !== null ? fmtPct(row.change_7d) : 'n/a') + ')' }), el('td', { class: 'num', text: growthMult.toFixed(3) })),
              el('tr', null, el('td', { text: 'Maturity mult (Age ' + (row.age_days !== null ? row.age_days + 'd' : 'unknown') + ')' }), el('td', { class: 'num', text: maturityMult.toFixed(3) })),
              el('tr', null, el('td', { text: 'Chain reach (' + (row.chains ? row.chains.length : 0) + ' chains)' }), el('td', { class: 'num', text: chainMult.toFixed(3) }))
            )
          )
        ),

        // Farm plan
        el('div', null,
          el('div', { class: 'section-title', text: 'Farm plan' }),
          farmStepsList
        ),

        // Risk notes
        el('div', null,
          el('div', { class: 'section-title', text: 'Risk notes' }),
          el('div', { class: 'risk-box' },
            el('b', { text: 'Important Safety & Risk Warnings:' }),
            el('ul', null, riskNotesLi)
          )
        )
      )
    );

    backdrop.classList.add('open');
    drawer.classList.add('open');
  }

  function closeDrawer() {
    state.selected = null;
    writeHash();
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
  }

  function renderAll() {
    var app = document.getElementById('radar-app');
    if (!app) return;
    app.textContent = '';

    var container = el('div', { class: 'container' },
      renderHeader(),
      renderStatStrip(),
      renderHowItWorks(),
      renderControls(),
      renderTableContainer(),
      renderFooter()
    );

    app.appendChild(container);
    app.appendChild(backdrop);
    app.appendChild(drawer);

    if (state.selected) {
      openDrawer(state.selected);
    }
  }

  readHash();
  renderAll();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeDrawer();
    }
  });

})();
