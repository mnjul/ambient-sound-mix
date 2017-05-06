;(function(){

'use strict';

const AC = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AC();

// 0 -> top-left
// 1 -> bottom-left
// 2 -> top-right
// 3 -> bottom-right

const C = {
  filenames: [
    [
      '00.mp3',
      '01.mp3',
      '02.mp3',
      '03.mp3',
    ],
    [
      '10.mp3',
      '11.mp3',
      '12.mp3',
      '13.mp3',
    ],
    [
      '20.mp3',
      '21.mp3',
      '22.mp3',
      '23.mp3',
    ],
    [
      '30.mp3',
      '31.mp3',
      '32.mp3',
    ],
  ],

  loaderColors: [
    {h:  16, s: 66, l: 52, r: 0xd5, g: 0x5f, b: 0x34},
    {h: 302, s: 85, l: 59, r: 0xef, g: 0x3d, b: 0xe8},
    {h: 196, s: 66, l: 52, r: 0x33, g: 0xab, b: 0xd6},
    {h: 254, s: 85, l: 59, r: 0x67, g: 0x3e, b: 0xf0}
  ],

  startBG_L: 0,

  fadeStep: 0.05,
  fadeInterval: 20, // ms

  hideTipAfter: 1500, // ms

  hinterRadius: 40, // XXX: should be calculated from computed style
  subHinterRadius: 10,
  hinterSubHinterDistance: 72, // between centers

  maxVolMaxDistRatio: 0.1,
  minVolDistRatio: 0.9,

};

let S = { // shuffled
  filenames: [],
  loaderColors: [],
};

function limit01(v){
  return Math.max(0, Math.min(1, v));
}

function removeElm(elm){
  if(elm.parentNode){
    elm.parentNode.removeChild(elm);
  }
}

class FullscreenUtil{
  static _getReqFS(){
    let docEl = document.documentElement;

    // note the capitalization of "s" in screen in https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen and https://msdn.microsoft.com/en-us/library/dn254939%28v=vs.85%29.aspx
    let requestFullscreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;

    return [docEl, requestFullscreen];
  }

  static isFullscreenAvailable(){
    let [_, requestFullscreen] = FullscreenUtil._getReqFS();

    return !!requestFullscreen;
  }

  static requestFullscreen(){
    let [docEl, requestFullscreen] = FullscreenUtil._getReqFS();
    if(requestFullscreen){
      requestFullscreen.call(docEl);
    }
  }
}

class UIStateMaintainer{
  init(){
    document.body.classList.add('state-init');
  }

  loaded(){
    document.body.classList.remove('state-init');
    document.body.classList.add('state-loaded');
  }

  ready(mixer, eventHandlers){
    document.body.classList.remove('state-loaded');
    document.body.classList.add('state-ready');

    let _start = () => {

      document.getElementById('event-sink').removeEventListener('mouseup', _start);
      this.start();
      mixer.start();
      eventHandlers.bindEventListeners();
    };

    document.getElementById('event-sink').addEventListener('mouseup', _start);
  }

  start(){
    removeElm(document.getElementById('go'));
    removeElm(document.getElementById('go-hint'));

    window.scrollTo(0, 100); // not a bad way to bypass mobile safari's vh calculation w.r.t. toolbar that can be scrolled out
                             // has no impact with other platforms either (where we just can't scroll)

    document.getElementById('init-loaders').addEventListener('transitionend', e => removeElm(e.target));

    document.body.classList.remove('state-ready');
    document.body.classList.add('state-started');

    // return;
    FullscreenUtil.requestFullscreen();
  }

  playing(){
    document.body.classList.add('state-playing');

    if(!document.body.classList.contains('state-no-tip')){
      this._currentTimeout = setTimeout(()=> {
        document.body.classList.add('state-no-tip');

        Array.from(document.querySelectorAll('.ready-tip')).forEach(elm => {
          elm.addEventListener('transitionend', e => removeElm(e.target));
        });
      }, C.hideTipAfter);
    }
  }

  stopping(){
    document.body.classList.remove('state-playing');
    clearTimeout(this._currentTimeout);
  }

  toggleAbout(){
    document.body.classList.toggle('state-about-shown');
  }

  setNoFullscreen(){
    document.body.classList.add('state-no-fullscreen');
  }
}

class UIEventHandlers{
  constructor(mixer, stateMaintainer){
    this._mixer = mixer;
    this._stateMaintainer = stateMaintainer;
    this._sink = document.getElementById('event-sink');

    this._aboutToggle = document.getElementById('about-toggle');
    this._about = document.getElementById('about');
  }

  bindEventListeners(){
    this._sink.addEventListener('mousedown', this.mousedown.bind(this));
    this._sink.addEventListener('mousemove', this.mousemove.bind(this));
    this._sink.addEventListener('mouseup', this.interactionStop.bind(this));

    this._sink.addEventListener('touchstart', this.touchstart.bind(this));
    this._sink.addEventListener('touchmove', this.touchmove.bind(this));
    this._sink.addEventListener('touchend', this.interactionStop.bind(this));
    this._sink.addEventListener('touchcancel', this.interactionStop.bind(this));

    this._aboutToggle.addEventListener('mousedown', this.aboutToggleMouseDown.bind(this));
    this._aboutToggle.addEventListener('mousemove', this.stopAboutEvent.bind(this));
    this._aboutToggle.addEventListener('mouseup', this.stopAboutEvent.bind(this));
    this._aboutToggle.addEventListener('touchstart', this.stopAboutEvent.bind(this));
    this._aboutToggle.addEventListener('touchmove', this.stopAboutEvent.bind(this));
    this._aboutToggle.addEventListener('touchend', this.stopAboutEvent.bind(this));
    this._aboutToggle.addEventListener('touchcancel', this.stopAboutEvent.bind(this));

    this._about.addEventListener('mousedown', this.stopAboutEvent.bind(this));
    this._about.addEventListener('mousemove', this.stopAboutEvent.bind(this));
    this._about.addEventListener('mouseup', this.stopAboutEvent.bind(this));
    this._about.addEventListener('touchstart', this.stopAboutEvent.bind(this));
    this._about.addEventListener('touchmove', this.stopAboutEvent.bind(this));
    this._about.addEventListener('touchend', this.stopAboutEvent.bind(this));
    this._about.addEventListener('touchcancel', this.stopAboutEvent.bind(this));
  }

  mousedown(e){
    if(e.button === 0){
      this._mixer.fadeIn();
      this._stateMaintainer.playing();
      UIMixerUtil.atPosition(e.clientX, e.clientY, this._mixer);
    }
  }

  mousemove(e){
    if((e.buttons & 1) === 1){ // always remember bitwise op has lower precendence...
      UIMixerUtil.atPosition(e.clientX, e.clientY, this._mixer);
    }
  }

  touchstart(e){
    e.preventDefault();
    this._mixer.fadeIn();
    this._stateMaintainer.playing();
    let touch = e.touches[0];
    UIMixerUtil.atPosition(touch.pageX, touch.pageY, this._mixer);
  }

  touchmove(e){
    e.preventDefault();
    let touch = e.touches[0];
    UIMixerUtil.atPosition(touch.pageX, touch.pageY, this._mixer);
  }

  interactionStop(e){
    this._mixer.fadeOut();
    this._stateMaintainer.stopping();
  }

  aboutToggleMouseDown(e){
    e.stopPropagation();
    this._stateMaintainer.toggleAbout();
  }

  stopAboutEvent(e){
    e.stopPropagation();
  }

}


class UIMixerUtil{
  static init(){
    UIMixerUtil.hinter = document.getElementById('hinter');
    UIMixerUtil.subHinters = S.filenames.map((_, idx) => document.getElementById(`sub-hinter-${idx}`));
  }

  static _calVols(x, y){
    function distFromOrigin(m, n){
      return Math.sqrt(m * m + n * n);
    }

    const ww = window.innerWidth, wh = window.innerHeight;
    const maxVolMaxDist = Math.min(ww, wh) * C.maxVolMaxDistRatio;
    const ellipseA = ww * C.minVolDistRatio;
    const ellipseB = wh * C.minVolDistRatio;

    const dists = [
      distFromOrigin(x,           y),
      distFromOrigin(x,      wh - y),
      distFromOrigin(ww - x,      y),
      distFromOrigin(ww - x, wh - y),
    ];

    let thetas = [];

    // law of sines
    thetas[0] = Math.atan2(y, x);
    thetas[1] = Math.PI / 2 - Math.asin(dists[0] * Math.sin(Math.PI / 2 - thetas[0]) / dists[1]);
    thetas[2] = Math.asin(dists[0] * Math.sin(thetas[0]) / dists[2]);
    thetas[3] = Math.asin(dists[1] * Math.sin(thetas[1]) / dists[3]);

    // console.log('thetas (deg)', thetas.map(theta => theta / Math.PI * 180));

    let radii = thetas.map(theta => ellipseA * ellipseB / distFromOrigin(ellipseA * Math.sin(theta), ellipseB * Math.cos(theta)));

    // console.log('radii', radii);

    let vols = radii.map((radius, i) => {
      if(radius <= maxVolMaxDist){
        return 1;
      }else{
        return 1 - (dists[i] - maxVolMaxDist) / (radius - maxVolMaxDist);
      }
    }).map(limit01);

    // equalize & boost, especially useful at center
    let totalVol = vols.reduce((acc, cur) => acc + cur, 0);
    vols = vols.map(vol => vol / totalVol * vols.reduce((acc, cur) => acc + limit01((cur - 0.1) / 0.1), 0));

    // let s  = vols[0] + '<br />';
    //     s += vols[1] + '<br />';
    //     s += vols[2] + '<br />';
    //     s += vols[3] + '<br />';

    // document.getElementById('info').innerHTML = s;

    return vols;
  }

  static _setSubHinterColor(subHinter, vol, loaderColor){
      let borderAlpha, bgAlpha, borderStyle;

      if(vol >= 0.6){
        borderAlpha = vol;
        bgAlpha = vol;
        borderStyle = 'solid';

      }else if(vol >= 0.2){
        borderAlpha = 0.4 + ((vol - 0.2) / 0.4) * 0.2;
        bgAlpha = 0.4 + ((vol - 0.2) / 0.4) * 0.2;
        borderStyle = 'solid';

      }else{
        borderAlpha = 0.2 + (vol / 0.2) * 0.2;
        bgAlpha = (vol / 0.2) * 0.4;
        borderStyle = 'dashed';
      }

      let {h, s, l, r, g, b} = loaderColor;

      borderAlpha = borderAlpha.toFixed(2);
      bgAlpha = bgAlpha.toFixed(2);

      subHinter.style.borderColor = `hsla(${h}, ${s}%, ${l}%, ${borderAlpha})`;
      subHinter.style.backgroundColor = `hsla(${h}, ${s}%, ${l}%, ${bgAlpha})`;
      subHinter.style.borderStyle = borderStyle;
  }

  static _setSubHinterPos(subHinter, x, y, refPoint){
    const {l, t} = refPoint;

    let refDistance = Math.sqrt((x - l) * (x - l) + (y - t) * (y - t));
    let distRatio = C.hinterSubHinterDistance / refDistance;
    let subHinterL = x + (l- x) * distRatio - C.subHinterRadius;
    let subHinterT = y + (t - y) * distRatio - C.subHinterRadius;

    subHinter.style.top = `${subHinterT.toFixed(1)}px`;
    subHinter.style.left = `${subHinterL.toFixed(1)}px`;
  }

  static _setHinter(x, y, vols){
    UIMixerUtil.hinter.style.left = `${x - C.hinterRadius}px`;
    UIMixerUtil.hinter.style.top = `${y - C.hinterRadius}px`;

    const refPoints = [
      {l: 0,                 t: 0},
      {l: 0,                 t: window.innerHeight},
      {l: window.innerWidth, t: 0},
      {l: window.innerWidth, t: window.innerHeight},
    ];

    UIMixerUtil.subHinters.forEach((subHinter, i) => {
      UIMixerUtil._setSubHinterColor(subHinter, vols[i], S.loaderColors[i]);
      UIMixerUtil._setSubHinterPos(subHinter, x, y, refPoints[i])
    });
  }

  static atPosition(x, y, mixer){
    const vols = UIMixerUtil._calVols(x, y);

    UIMixerUtil._setHinter(x, y, vols);

    mixer.setBufferGainersVolume(vols);
  }
}




class Mixer{
  constructor(buffers){
    this._masterGainer = Mixer._factorizeGainer(audioCtx.destination);

    this._bufferGainers = buffers.map(Mixer._factorizeGainer.bind(window, this._masterGainer));

    this._bufferSources = buffers.map((buffer, idx) => {
      let bs = audioCtx.createBufferSource();
      bs.loop = true;
      bs.buffer = buffer;
      bs.connect(this._bufferGainers[idx]);
      return bs;
    });

    this._targetVolume = 0;
  }

  start(){
    this._bufferSources.forEach(bs => bs.start());
  }

  fadeIn(){
    this._targetVolume = 1;
    this._checkFader();
  }

  fadeOut(){
    this._targetVolume = 0;
    this._checkFader();
  }

  _checkFader(){
    if(this._targetVolume !== this._masterGainer.gain.value){
      if(this._targetVolume > this._masterGainer.gain.value){
        this._masterGainer.gain.value = limit01(this._masterGainer.gain.value + C.fadeStep);
      }else{
        this._masterGainer.gain.value = limit01(this._masterGainer.gain.value - C.fadeStep);
      }
      setTimeout(this._checkFader.bind(this), C.fadeInterval);
    }
  }

  setBufferGainersVolume(vols){
    this._bufferGainers.forEach((gainer, idx) => {
      gainer.gain.value = limit01(vols[idx]);
    });
  }

  static _factorizeGainer(destNode){
    let gainer = audioCtx.createGain();
    gainer.gain.value = 0;
    gainer.connect(destNode);
    return gainer;
  }
}









class UIStreamLoader{
  constructor(filename, idx){
    this.filename = filename;
    this.idx = idx;
    this._elm = document.getElementById(`init-loaders-${this.idx}`);
  }

  _onProgress(evt){
    if(evt.lengthComputable){
      let progress = evt.loaded / evt.total;

      let height = 25 * progress;
      this._elm.style.height = `${height}vh`;

      let saturation = S.loaderColors[this.idx].s * (1 - progress);
      let lightness = (S.loaderColors[this.idx].l - C.startBG_L) * (1 - progress) + C.startBG_L;

      this._elm.style.backgroundColor = `hsl(${S.loaderColors[this.idx].h}, ${saturation}%, ${lightness}%`;
    }
  }

  load(){
    // need progress event, so can't use fetch
    let req = new XMLHttpRequest();
    req.open('get', 'sound/' + this.filename, true);
    req.responseType = 'arraybuffer';

    req.addEventListener('progress', UIStreamLoader.prototype._onProgress.bind(this));
    req.send();

    return new Promise((resolve, reject) => {
      req.addEventListener('load', () => {
        resolve(req.response);
      });
      req.addEventListener('abort', () => {
        reject(req.statusText);
      });
      req.addEventListener('error', () => {
        reject(req.statusText);
      });
    });
  }
}


function shuffleCIntoS(){
  // fisher-yates. probably too heavy for a four-element array, though...
  let shuffler = C.filenames.map((_, idx) => idx);
  for(let i = shuffler.length - 1; i > 0; i--){
    let j = Math.floor(Math.random() * (i + 1));
    [shuffler[i], shuffler[j]] = [shuffler[j], shuffler[i]];
  }

  S.filenames = shuffler.map(i => C.filenames[i][Math.floor(Math.random() * C.filenames[i].length)]);
  S.loaderColors = shuffler.map(i => C.loaderColors[i]);
}

function documentReady(){
  let stateMaintainer;

  shuffleCIntoS();

  UIMixerUtil.init();

  stateMaintainer = new UIStateMaintainer();
  stateMaintainer.init();

  // resolves into buffers
  Promise.all(
    S.filenames
      .map((filename, idx) => new UIStreamLoader(filename, idx))
      .map(loader => loader.load())
  ).then(arraybuffers => {
    stateMaintainer.loaded();
    return Promise.all(arraybuffers.map(arraybuffer => new Promise((resolve, reject) => {
      // ios 10 safari doesn't have promise-returning decodeAudioData
      audioCtx.decodeAudioData(arraybuffer, buffer => {
        resolve(buffer);
      }, e => {
        console.error(e);
        reject(e);
      });
    })));
  }).then(buffers => {
    if(!FullscreenUtil.isFullscreenAvailable()){
      stateMaintainer.setNoFullscreen();
    }

    let mixer = new Mixer(buffers);

    let eventHandlers = new UIEventHandlers(mixer, stateMaintainer);

    stateMaintainer.ready(mixer, eventHandlers);

  }).catch(e => {
    console.error(e);
  });
}


document.addEventListener('DOMContentLoaded', documentReady);

})();
