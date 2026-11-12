const sunrays = document.querySelectorAll('.sunrays');
const initializer = [];
const saved_css = [
  ['.photo img', 'filter'],
  ['.sun', 'width' ],
  ['.sun', 'box-shadow' ],
  ['.sun', 'top' ],
  ['.sun', 'left' ],
  ['.sunrays', 'perspective-origin'],
  ['.sunrays', 'perspective'],
  ['.light', 'box-shadow'],
  ['.light', 'height'],
  ['.light', 'transform-origin'],
  ['.light', 'transform'],
  ['.mask', 'height'],
];

let use_vw_unit = false;

(function(rays) {
  for (const rn of rays) {
    ['top', 'left', 'opacity', 'transform'].forEach(p => {
      saved_css.push([`.sunrays.${rn}`, p]);
    });
    saved_css.push([`.${rn} .light`, 'height'])
  }
})(getSunraysArray());

for (const prop of saved_css) {
  const pval = getCSSValue(prop[0], prop[1]);
  prop.push(pval);
}

function getSunraysArray(prefix) {
  const list = [];
  if (!prefix) {
    prefix = '';
  }
  for (let i = 0; i < sunrays.length; i++) {
    const rn = `r${i + 1}`;
    list.push(`${prefix}${rn}`);
  }
  return list;
}

function createCheckbox(id, text, checked, value) {
  const label = document.createElement('label');
  label.setAttribute('for', id);
  const item = document.createElement('input');
  item.id = id;
  item.setAttribute('type', 'checkbox');
  if (value) {
    item.value = value;
  }
  item.checked = checked;
  label.appendChild(item);
  
  const el = document.createTextNode(` ${text}`);
  label.appendChild(el);
  return label;
}

function createRangeSlider(id, text, min, max, step) {
  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = `${text}: `;
  const item = document.createElement('input');
  item.id = id;
  item.setAttribute('type', 'range');
  item.setAttribute('min', min);
  item.setAttribute('max', max);
  if (step) {
    item.setAttribute('step', step);
  }
  label.appendChild(item);
  return label;
}

function setRangeSlider(sel, val, unit) {
  const el = document.getElementById(sel);
  el.value =  updateRangeValue(el, val, unit);
}

(function() {
  let target = document.getElementById('var-perspective');
  let el = createRangeSlider('pers-length', 'length', 1, 100);
  target.appendChild(el);
  el = createRangeSlider('pers-origin-x', 'origin-x', -100, 100);
  target.appendChild(el);
  el = createRangeSlider('pers-origin-y', 'origin-y', -100, 100);
  target.appendChild(el);
  
  target = document.getElementById('var-sun');
  el = createRangeSlider('sun-width', 'size', 1, 15);
  target.appendChild(el);
  el = createRangeSlider('sun-top', 'top', -30, 100);
  target.appendChild(el);
  el = createRangeSlider('sun-left', 'left', -50, 100);
  target.appendChild(el);
  
  target = document.getElementById('var-sun-shadow');
  el = createRangeSlider('sun-shadow-x', 'offset-x', 0, 300);
  target.appendChild(el);
  el = createRangeSlider('sun-shadow-y', 'offset-y', 0, 300);
  target.appendChild(el);
  el = createRangeSlider('sun-shadow-blur', 'blur', 0, 50);
  target.appendChild(el);
  
  target = document.getElementById('var-light-shadow');
  el = createRangeSlider('light-shadow-x', 'offset-x', 0, 300);
  target.appendChild(el);
  el = createRangeSlider('light-shadow-y', 'offset-y', -100, 300);
  target.appendChild(el);
  el = createRangeSlider('light-shadow-blur', 'blur', 0, 50);
  target.appendChild(el);
  
  target = document.getElementById('var-light-origin');
  el = createRangeSlider('light-origin-x', 'x', -50, 150);
  target.appendChild(el);
  el = createRangeSlider('light-origin-y', 'y', -50, 150);
  target.appendChild(el);
  el = createRangeSlider('light-origin-z', 'z', 0, 200);
  target.appendChild(el);
  
  target = document.getElementById('var-light-transform');
  el = createRangeSlider('light-translateZ', 'translateZ', 0, 300);
  target.appendChild(el);
  el = createRangeSlider('light-rotateX', 'rotateX', -360, 360);
  target.appendChild(el);
  el = createRangeSlider('light-rotateY', 'rotateY', -360, 360);
  target.appendChild(el);
  el = createRangeSlider('light-rotateZ', 'rotateZ', -360, 360);
  target.appendChild(el);
  
  target = document.getElementById('var-filter');
  el = createRangeSlider('filter-brightness', 'brightness', 0, 1, 0.1);
  target.appendChild(el);
  el = createRangeSlider('filter-contrast', 'contrast', 0, 100);
  target.appendChild(el);
  
  target = document.getElementById('var-mask');
  el = createRangeSlider('mask-height', 'height', 0, 100);
  target.appendChild(el);
})();

(function(rays) {
  let el;
  let target = document.getElementById('var-sunrays');
  for (const rn of rays) {
    el = createCheckbox(`cb-${rn}`, rn, true, rn);
    target.appendChild(el);
  }
  el = createCheckbox('cb-sun', 'sun', true);
  target.appendChild(el);
  
  target = document.getElementById('var-position');
  for (const rn of rays) {
    el = createRangeSlider(`${rn}-top`, `${rn}.top`, 0, 100);
    target.appendChild(el);
    el = createRangeSlider(`${rn}-left`, `${rn}.left`, -100, 100);
    target.appendChild(el);
  }
  
  target = document.getElementById('var-angle');
  for (const rn of rays) {
    el = createRangeSlider(`${rn}-rotate`, `${rn}`, -180, 180);
    target.appendChild(el);
  }
  
  target = document.getElementById('var-opacity');
  for (const rn of rays) {
    el = createRangeSlider(`opacity-${rn}`, rn, 0, 1, 0.05);
    target.appendChild(el);
  }
  
  target = document.getElementById('var-light-height');
  for (const rn of rays) {
    el = createRangeSlider(`height-${rn}`, `${rn}.height`, 10, 100);
    target.appendChild(el);
  }
})(getSunraysArray());

/*
 * sunrays position, angle
 */
function visible(el, yes) {
  if (yes) {
    el.removeAttribute('style');
  } else {
    el.style.display = 'none';
  }
}

getSunraysArray('cb-').forEach(sel => {
  const el = document.getElementById(sel);
  el.addEventListener('click', function() {
    const target = document.querySelector(`.${this.value}`);
    visible(target, this.checked);
  });
});

document.getElementById('cb-sun').addEventListener('click', function() {
  const target = document.querySelector('.sun');
  visible(target, this.checked);
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  getSunraysArray().forEach(rn => {
    const o = getPosition(`.sunrays.${rn}`);
    setRangeSlider(`${rn}-top`, o.top, '%');
    setRangeSlider(`${rn}-left`, o.left, '%');
  });
});

function getPosition(sel) {
  const o = {};
  o.top = getCSSValue(sel, 'top');
  o.left = getCSSValue(sel, 'left');
  return o;
}

getSunraysArray().forEach(rn => {
  [`${rn}-top`, `${rn}-left`].forEach(sel => {
    const item = document.getElementById(sel);
    item.addEventListener('input', function() {
      updateRangeValue(this, this.value, '%');
      const prop = /-top$/.test(sel)? 'top': 'left';
      setCSSValue(`.sunrays.${rn}`, prop, `${this.value}%`)
    });
  });
});

function getRayAngle(sel) {
  const o = {};
  const pval = getCSSValue(sel, 'transform');
  const found = pval.match(/rotate\((-?[0-9]+deg)\)/);
  o.angle = found[1];
  return o;
}

(function(init) {
  init();
  initializer.push(init);
})(function() {
  getSunraysArray().forEach(rn => {
    const o = getRayAngle(`.sunrays.${rn}`);
    setRangeSlider(`${rn}-rotate`, o.angle, 'deg');
  })
});

getSunraysArray().forEach(rn => {
  const item = document.getElementById(`${rn}-rotate`);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, 'deg');
    const pval = `rotate(${this.value}deg)`;
    setCSSValue(`.sunrays.${rn}`, 'transform', pval);
  });
});

  
document.getElementById('cb-ol').addEventListener('click', function() {
  const el = document.querySelector('.container');
  if (this.checked) {
    el.classList.add('outline');
  } else {
    el.classList.remove('outline');
  }
});

/*
 * perspective, perspective-origin
 */
(function(init) {
  init();
  initializer.push(init);
})(function() {
  const pval = getCSSValue('.sunrays', 'perspective');
  setRangeSlider('pers-length', pval, 'px');
});

document.getElementById('pers-length').addEventListener('input', function() {
  updateRangeValue(this, this.value, 'px');
  setCSSValue(`.sunrays`, 'perspective', `${this.value}px`) 
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  let pval = getCSSValue('.sunrays', 'perspective-origin');
  let arr = pval.split(' ');
  setRangeSlider('pers-origin-x', arr[0], '%');
  setRangeSlider('pers-origin-y', arr[1], '%');
});

['x', 'y'].forEach(c => {
  const id = `pers-origin-${c}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, '%');
    const ret = getCSSValue('.sunrays', 'perspective-origin');
    const arr = ret.split(' ');
    let pval = '';
    if (c == 'x') {
      pval = `${this.value}% ${arr[1]}`;
    } else {
      pval = `${arr[0]} ${this.value}%`;
    }
    setCSSValue('.sunrays', 'perspective-origin', pval);
  });
});


(function(init) {
  init();
  initializer.push(init);
})(function() {
  getSunraysArray().forEach(rn => {
    const pval = getCSSValue(`.sunrays.${rn}`, 'opacity');
    setRangeSlider(`opacity-${rn}`, pval);
  });
});

getSunraysArray().forEach(rn => {
  const item = document.getElementById(`opacity-${rn}`);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value);
    setCSSValue(`.sunrays.${rn}`, 'opacity', this.value);
  });
});

/*
 * sun
 */
(function(init) {
  init();
  initializer.push(init);
})(function() {
  let pval = getCSSValue('.sun', 'width');
  setRangeSlider('sun-width', pval, '%');
  ['top', 'left'].forEach(p => {
    pval = getCSSValue('.sun', p);
    setRangeSlider(`sun-${p}`, pval, '%');
  });
});

document.getElementById('sun-width').addEventListener('input', function() {
  updateRangeValue(this, this.value, '%');
  const d = `${this.value}%`;
  setCSSValue('.sun', 'width', d);
});

['top', 'left'].forEach(p => {
  const item = document.getElementById(`sun-${p}`);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, '%');
    setCSSValue('.sun', p, `${this.value}%`);
  });
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  o = getBoxShadow('.sun');
  if (/vw/.test(o.x)) {
    o = vw2px(o);
  }
  setRangeSlider('sun-shadow-x', o.x, 'px');
  setRangeSlider('sun-shadow-y', o.y, 'px');
  setRangeSlider('sun-shadow-blur', o.blur, 'px');
  
  document.getElementById('sun-color').value = rgb2hex(o.color);
});

function rgb2hex(rgb) {
  const found = rgb.match(/rgb\(([0-9, ]+)\)/);
  const args = found[1].split(', ');
  let hex = '#';
  for (const c of args) {
    let v = (+c).toString(16);
    if (v.length === 1) {
      v = '0' + v;
    }
    hex += v;
  }
  return hex;
}

['x', 'y', 'blur'].forEach(c => {
  const id = `sun-shadow-${c}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, 'px');
    const o = getBoxShadow('.sun');
    o[c] = `${this.value}px`;
    setBoxShadow('.sun', o);
  });
});

document.getElementById('sun-color').addEventListener('input', function() {
  let o = getBoxShadow('.sun');
  o.color = this.value;
  setBoxShadow('.sun', o);
  o = getBoxShadow('.light');
  o.color = this.value;
  setBoxShadow('.light', o);
});

/*
 * light
 */
(function(init) {
  init();
  initializer.push(init);
})(function() {
  getSunraysArray().forEach(rn => {
    const pval = getCSSValue(`.${rn} .light`, 'height');
    setRangeSlider(`height-${rn}`, pval, '%');
  });
});

getSunraysArray().forEach(rn => {
  const item = document.getElementById(`height-${rn}`);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, '%');
    setCSSValue(`.${rn} .light`, 'height', `${this.value}%`);
  });
});

function getBoxShadow(sel) {
  const pval = getCSSValue(sel, 'box-shadow');
  // "rgb(255, 255, 255) -20px -60px 38px"
  const o = {};
  const found = pval.match(/[a-z]+\([^(]+\)/);
  o.color = found[0];
  const args = pval.replace(/\([0-9, ]+\)/g, '').split(' ');
  o.x = args[1];
  o.y = args[2];
  o.blur = args[3];
  return o;
}

function setBoxShadow(sel, o) {
  if (use_vw_unit) {
    if (/px/.test(o.x)) {
      o = px2vw(o);
    }
  } else if (/vw/.test(o.x)) {
    o = vw2px(o);
  }
  const pval = `${o.color} ${o.x} ${o.y} ${o.blur}`;
  setCSSValue(sel, 'box-shadow', pval);
}

function px2vw(o) {
  const conv = (px) => {
    const x = parseFloat(px);
    return (100 * x / 960).toFixed(2);
  }
  const val = {};
  val.color = o.color;
  for (const c of ['x', 'y', 'blur']) {
    val[c] = conv(o[c]) + 'vw';
  }
  return val;
}

function vw2px(o) {
  const conv = (vw) => {
    const x = parseFloat(vw);
    return Math.floor(960 * x / 100);
  }
  const val = {};
  val.color = o.color;
  for (const c of ['x', 'y', 'blur']) {
    val[c] = conv(o[c]) + 'px';
  }
  return val;
}

(function(init) {
  init();
  initializer.push(init);
})(function() {
  o = getBoxShadow('.light');
  if (/vw/.test(o.x)) {
    o = vw2px(o);
  }
  setRangeSlider('light-shadow-x', o.x, 'px');
  setRangeSlider('light-shadow-y', o.y, 'px');
  setRangeSlider('light-shadow-blur', o.blur, 'px');
});

['x', 'y', 'blur'].forEach(c => {
  const id = `light-shadow-${c}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    updateRangeValue(this, this.value, 'px');
    const o = getBoxShadow('.light');
    o[c] = `${this.value}px`;
    setBoxShadow('.light', o);
  });
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  const o = getTransformOrigin('.light');
  setRangeSlider('light-origin-x', o.x, '%');
  setRangeSlider('light-origin-y', o.y, '%');
  setRangeSlider('light-origin-z', o.z, 'px');
});

function getTransformOrigin(sel) {
  const pval = getCSSValue(sel, 'transform-origin');
  const origin = pval.split(' ');
  const o = {};
  o.x = origin[0];
  o.y = origin[1];
  o.z = origin[2];
  return o;
}

function setTransformOrigin(sel, o) {
  const pval = `${o.x} ${o.y} ${o.z}`;
  setCSSValue(sel, 'transform-origin', pval);
}

['x', 'y', 'z'].forEach(c => {
  const id = `light-origin-${c}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    const unit = (c == 'z')? 'px': '%';
    updateRangeValue(this, this.value, unit);
    const o = getTransformOrigin('.light');
    o[c] = `${this.value}${unit}`;
    setTransformOrigin('.light', o)
  });
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  const o = getTransform('.light');
  setRangeSlider('light-translateZ', o.translateZ, 'px');
  setRangeSlider('light-rotateX', o.rotateX, 'deg');
  setRangeSlider('light-rotateY', o.rotateY, 'deg');
  setRangeSlider('light-rotateZ', o.rotateZ, 'deg');
});
  
function getTransform(sel) {
  const pval = getCSSValue(sel, 'transform');
  const args = pval.split(' ');
  const o = {};
  for (const a of args) {
    const found = a.match(/([a-z]+[XYZ])\((-?[0-9]+(deg|px))\)/);
    o[found[1]] = found[2];
  }
  return o;
}

function setTransform(sel, o) {
  const pval = `rotateZ(${o.rotateZ}) rotateY(${o.rotateY}) rotateX(${o.rotateX}) translateZ(${o.translateZ})`;
  setCSSValue(sel, 'transform', pval);
}

['translateZ', 'rotateX', 'rotateY', 'rotateZ'].forEach(f => {
  const id = `light-${f}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    const unit = (f == 'translateZ')? 'px': 'deg';
    updateRangeValue(this, this.value, unit);
    const o = getTransform('.light');
    o[f] = `${this.value}${unit}`;
    setTransform('.light', o);
  });
});

/*
 * filter
 */
(function(init) {
  init();
  initializer.push(init);
})(function() {
  const o = getFilter('.photo img');
  let el = document.getElementById('filter-brightness');
  el.value = updateRangeValue(el, o.brightness);
  
  el = document.getElementById('filter-contrast');
  el.value = updateRangeValue(el, o.contrast, '%');
});

function getFilter(sel) {
  const pval = getCSSValue(sel, 'filter');
  const filters = pval.split(' ');
  const o = {};
  let found = filters[0].match(/brightness\(([0-9.]+)\)/);
  o.brightness = found[1];
  
  found = filters[1].match(/contrast\(([0-9]+%)\)/);
  o.contrast = found[1];
  return o;
}

function setFiter(sel, o) {
  let pval = `brightness(${o.brightness}) contrast(${o.contrast})`;
  setCSSValue(sel, 'filter', pval);
}

['brightness', 'contrast'].forEach(c => {
  const id = `filter-${c}`;
  const item = document.getElementById(id);
  item.addEventListener('input', function() {
    const unit = (c == 'contrast')? '%': '';
    updateRangeValue(this, this.value, unit);
    const o = getFilter('.photo img');
    let pval = this.value;
    pval += unit;
    o[c] = pval;
    setFiter('.photo img', o);
  });
});

(function(init) {
  init();
  initializer.push(init);
})(function() {
  const height = getCSSValue('.mask', 'height');
  const el = document.getElementById('mask-height');
  el.value = updateRangeValue(el, height, '%');
});

document.getElementById('mask-height').addEventListener('input', function() {
  updateRangeValue(this, this.value, '%');
  setCSSValue('.mask', 'height', `${this.value}%`);
});

function updateRangeValue(item, val, unit) {
  if (typeof item === 'string') {
    item = document.getElementById(item);
  }
  if (!unit) {
    unit = '';
  }
  let el = item.parentElement.querySelector('.val');
  if (!el) {
    el = document.createElement('span');
    el.classList.add('val');
    item.parentElement.insertBefore(el, item.nextSibling);
  }
  const v = val.replace(unit, '');
  el.textContent = `${v}${unit}`;
  return v;
}

document.getElementById('reset-btn').addEventListener('click', function() {
  for (const prop of saved_css) {
    setCSSValue(prop[0], prop[1], prop[2]);
  }
  convertShadowUnit();
  for (const f of initializer) {
    f();
  }
  [...getSunraysArray('cb-'), 'cb-sun'].forEach(sel => {
    const el = document.getElementById(sel);
    el.checked = true;
    el.dispatchEvent(new Event('click'));
  });
  
  ['cb-ol'].forEach(sel => {
    const el = document.getElementById(sel);
    el.checked = false;
    el.dispatchEvent(new Event('click'));
  });
  
  eraseCSS('.css-code');
});

function clickReset() {
  const el = document.getElementById('reset-btn');
  el.dispatchEvent(new Event('click'));
}

document.getElementById('css-btn').addEventListener('click', function() {
  const el = document.querySelector('.css-code');
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    el.innerHTML = '';
    displayCSS(el);
  } else {
    eraseCSS(el);
  }
});

function eraseCSS(target) {
  if (typeof target === 'string') {
    target = document.querySelector(target);
  }
  target.classList.remove('active');
  target.innerHTML = '';
}

function displayCSS(target) {
  const cssMap = new Map();
  for (const prop of saved_css) {
    const sel = prop[0];
    let rules = cssMap.get(sel);
    if (!rules) {
      rules = [];
      cssMap.set(sel, rules);
    }
    const pval = getCSSValue(sel, prop[1]);;
    rules.push([prop[1], pval]);
  }
  let content = '';
  for (const [sel, rules] of cssMap) {
    content += toCSSRules(sel, rules);
  }
  
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = content;
  pre.appendChild(code);
  target.appendChild(pre);
}

function toCSSRules(sel, rules) {
  let code = `${sel} {\n`;
  for (const r of rules) {
    code += `  ${r[0]}: ${r[1]};\n`;
  }
  code += '}\n';
  return code;
}

/*
 * DEMO
 */
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

function tween1(progress) {
  let o = getBoxShadow('.light');
  if (/vw/.test(o.y)) {
    o = vw2px(o);
  }
  let y = parseInt(o.y);
  
  if (progress > 0.5) {
    y -= 1;
  } else {
    y += 1;
  }
  y = clamp(y, -30, 0);
  o.y = `${y}px`;
  setBoxShadow('.light', o);
  if (progress >= 1) {
    setRangeSlider('light-shadow-y', o.y, 'px');
  }
}

function tween2(progress) {
  let pval = getCSSValue('.r2 .light', 'height');
  let height = parseInt(pval);
  if (progress > 0.5) {
    height += 1;
  } else {
    height -= 1;
  }
  height = clamp(height, 10, 100);
  pval = `${height}%`;
  setCSSValue('.r2 .light', 'height', pval);
  if (progress >= 1) {
    setRangeSlider('height-r2', pval, '%');
  }
}

function tween3(progress) {
  const o = getTransform('.light');
  let z = parseInt(o.rotateZ);
  if (progress > 0.5) {
    z += 2;
  } else {
    z -= 2;
  }
  z = clamp(z, -40, 30);
  o.rotateZ = `${z}deg`;
  setTransform('.light', o);
  if (progress >= 1) {
    setRangeSlider('light-rotateZ', o.rotateZ, 'deg');
  }
}

function tween4(progress) {
  ['r1', 'r2'].forEach(rn => {
    let pval = getCSSValue(`.sunrays.${rn}`, 'opacity');
    let opacity = +pval;
    if (progress > 0.5) {
      opacity += 0.1;
    } else {
      opacity -= 0.1;
    }
    opacity = clamp(opacity, 0.4, 0.8);
    setCSSValue(`.sunrays.${rn}`, 'opacity', opacity);
    if (progress >= 1) {
      setRangeSlider(`opacity-${rn}`, String(opacity));
    }
  });
}

function tween5(progress) {
  let pval = getCSSValue('.sun', 'width');
  let w = parseFloat(pval);
  if (progress > 0.5) {
    w += 0.1
  } else {
    w -= 0.1
  }
  w = clamp(w, 4, 6);
  pval = `${w}%`;
  setCSSValue('.sun', 'width', pval);
  if (progress >= 1) {
    setRangeSlider('sun-width', pval, '%');
  }
}

function play(duration) {
  if (!duration) {
    duration = 20;
  }
  let t = duration;
 
  (function proc() {
    let progress = 1 - t / duration;
    tween1(progress);
    tween2(progress);
    tween3(progress);
    tween4(progress);
    tween5(progress);
    t--;
    if (t >= 0) {
      setTimeout(proc, 100);
    } else {
      setTimeout(clickReset, 2000);
    }
  })();
}
play(30);

document.getElementById('play-btn').addEventListener('click', function() {
  play(50);
})

function getCSSValue(selector, prop) {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText) {
        continue;
      }
      if (rule.selectorText == selector) {
        if (rule.style[prop]) {
          return rule.style[prop];
        }
      }
    }
  }
  return null;
}

function setCSSValue(selector, prop, value) {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText) {
        continue;
      }
      if (rule.selectorText == selector) {
        if (rule.style[prop]) {
          rule.style[prop] = value;
          return true;
        }
      }
    }
  }
  return false;
}

function convertShadowUnit() {
  const expect = use_vw_unit? /vw/: /px/;
  for (const p of saved_css) {
    if (p[1] == 'box-shadow') {
      let o = getBoxShadow(p[0]);
      if (!expect.test(o.x)) {
        setBoxShadow(p[0], o);
      }
    }
  }
}

function handleWidth(mql) {
  if (mql.matches) {
    use_vw_unit = true;
  } else {
    use_vw_unit = false;
  }
  convertShadowUnit();
}

(function() {
  const mql = window.matchMedia('(max-width: 960px)');
  handleWidth(mql);
  mql.addEventListener('change', handleWidth);
})();