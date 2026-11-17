// Footer visitor count: the site-wide total from GoatCounter (params.goatcounter in config.toml).
// GoatCounter answers only when "Allow adding visitor counts on your website" is on in its site
// settings. Until then the request is refused, the count stays hidden and the statistics stay
// private. Counts are cached by GoatCounter for up to four hours.
(function () {
  var el = document.querySelector('.visitor-count');
  if (!el || !window.fetch) return;

  fetch('https://' + el.getAttribute('data-goatcounter') + '.goatcounter.com/counter/TOTAL.json')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) {
      var n = parseInt(String(d.count).replace(/[^0-9]/g, ''), 10);  // count is a string like "1,234"
      if (!(n > 0)) return;
      el.querySelector('.visitor-count-n').textContent =
        n.toLocaleString('en-US') + (n === 1 ? ' visitor' : ' visitors');
      el.hidden = false;
    })
    .catch(function () {});
})();
