(function (window, document) {
  'use strict';

  var FormForge = {};

  function createIframe(src, attrs) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = attrs.width || '100%';
    iframe.style.height = attrs.height || '600px';
    iframe.style.border = attrs.border || 'none';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.borderRadius = attrs.borderRadius || '8px';
    iframe.style.display = 'block';
    iframe.className = attrs.className || 'formforge-embed-iframe';
    return iframe;
  }

  function listenForHeight(iframe, origin) {
    function onMessage(e) {
      if (origin && e.origin !== origin) return;
      try {
        var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg && msg.type === 'formforge:height' && msg.height) {
          iframe.style.height = msg.height + 'px';
        }
        if (msg && msg.type === 'formforge:submitted') {
          // bubble up to user-provided callback via custom event
          var ev = new CustomEvent('formforge:submitted', { detail: msg.payload || {} });
          iframe.dispatchEvent(ev);
        }
      } catch {
        // ignore parse errors
      }
    }

    window.addEventListener('message', onMessage, false);

    return function cleanup() {
      window.removeEventListener('message', onMessage, false);
    };
  }

  // embed into a container selector
  FormForge.embed = function (opts) {
    // opts: { formId, slug, container (selector or element), theme, width, height, onSubmit }
    if (!opts) return;
    var slug = opts.slug || opts.formId;
    var container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    if (!container) {
      console.warn('FormForge.embed: container not found');
      return;
    }

    var src = (opts.src || (window.location.origin + '/form/' + slug));

    var iframe = createIframe(src, { width: opts.width || '100%', height: opts.height || '600', borderRadius: '8px' });

    // allow data-theme param
    if (opts.theme) {
      iframe.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'theme=' + encodeURIComponent(opts.theme);
    }

    // clear container then append
    container.innerHTML = '';
    container.appendChild(iframe);

    var cleanup = listenForHeight(iframe, window.location.origin);

    // attach onSubmit
    if (typeof opts.onSubmit === 'function') {
      iframe.addEventListener('formforge:submitted', function (ev) {
        try {
          opts.onSubmit(ev.detail);
        } catch {
          // swallow
        }
      });
    }

    // return an API for consumer
    return {
      iframe: iframe,
      destroy: function () {
        cleanup();
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }
    };
  };

  // popup (modal) implementation
  FormForge.popup = function (opts) {
    // opts: { formId, slug, width, height, theme }
    opts = opts || {};
    var slug = opts.slug || opts.formId;
    var src = (opts.src || (window.location.origin + '/form/' + slug));
    if (opts.theme) src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'theme=' + encodeURIComponent(opts.theme);

    // overlay
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.right = 0;
    overlay.style.bottom = 0;
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = 999999;
    overlay.className = 'formforge-overlay';

    // container
    var wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '50%';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translate(-50%, -50%)';
    wrapper.style.width = (opts.width ? opts.width + 'px' : '600px');
    wrapper.style.height = (opts.height ? opts.height + 'px' : '700px');
    wrapper.style.background = '#fff';
    wrapper.style.borderRadius = '8px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
    wrapper.className = 'formforge-popup-wrapper';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '8px';
    closeBtn.style.top = '8px';
    closeBtn.style.zIndex = 1000000;
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';

    var iframe = createIframe(src, { width: '100%', height: '100%', borderRadius: 0 });

    wrapper.appendChild(closeBtn);
    wrapper.appendChild(iframe);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);

    var cleanup = listenForHeight(iframe, window.location.origin);

    function destroy() {
      cleanup();
      try { document.body.removeChild(overlay); } catch {}
    }

    closeBtn.addEventListener('click', destroy);

    // close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) destroy();
    });

    return { iframe: iframe, destroy: destroy };
  };

  // helper: open hosted form in a new window
  FormForge.open = function (opts) {
    opts = opts || {};
    var slug = opts.slug || opts.formId;
    var url = opts.src || (window.location.origin + '/form/' + slug);
    var w = opts.width || 900;
    var h = opts.height || 700;
    var left = (screen.width / 2) - (w / 2);
    var top = (screen.height / 2) - (h / 2);
    window.open(url, 'FormForge', 'toolbar=0,location=0,menubar=0,width=' + w + ',height=' + h + ',top=' + top + ',left=' + left + ',resizable=1');
  };

  // expose
  window.FormForge = FormForge;

  // postMessage instructions for embedded forms:
  // From the embedded form, send: window.parent.postMessage(JSON.stringify({ type: 'formforge:height', height: 1200 }), '*');
  // On submission send: window.parent.postMessage(JSON.stringify({ type: 'formforge:submitted', payload: { id: 'abc', values: {...} } }), '*');

})(window, document);
