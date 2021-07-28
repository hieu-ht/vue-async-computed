var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function (global, factory) {
  (typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? factory(exports) : typeof define === 'function' && define.amd ? define(['exports'], factory) : (global = global || self, factory(global.AsyncComputed = {}));
})(this, function (exports) {
  'use strict';

  function isComputedLazy(item) {
    return item.hasOwnProperty('lazy') && item.lazy;
  }

  function isLazyActive(vm, key) {
    return vm[lazyActivePrefix + key];
  }

  var lazyActivePrefix = 'async_computed$lazy_active$',
      lazyDataPrefix = 'async_computed$lazy_data$';

  function initLazy(data, key) {
    data[lazyActivePrefix + key] = false;
    data[lazyDataPrefix + key] = null;
  }

  function makeLazyComputed(key) {
    return {
      get: function get() {
        this[lazyActivePrefix + key] = true;
        return this[lazyDataPrefix + key];
      },
      set: function set(value) {
        this[lazyDataPrefix + key] = value;
      }
    };
  }

  function silentSetLazy(vm, key, value) {
    vm[lazyDataPrefix + key] = value;
  }
  function silentGetLazy(vm, key) {
    return vm[lazyDataPrefix + key];
  }

  var prefix = '_async_computed$';
  var DidNotUpdate = typeof Symbol === 'function' ? Symbol('did-not-update') : {};

  var vueInstance = void 0;

  var AsyncComputed = {
    install: function install(Vue, pluginOptions) {
      pluginOptions = pluginOptions || {};

      Vue.config.optionMergeStrategies.asyncComputed = Vue.config.optionMergeStrategies.computed;

      Vue.mixin({
        data: function data() {
          return {
            _asyncComputed: {}
          };
        },
        beforeCreate: function beforeCreate() {
          var _this = this;

          var optionData = this.$options.data;
          var asyncComputed = this.$options.asyncComputed || {};

          if (!this.$options.computed) this.$options.computed = {};

          this.$options.computed.$asyncComputed = function () {
            return _this.$data._asyncComputed;
          };

          if (!Object.keys(asyncComputed).length) return;

          for (var key in asyncComputed) {
            var getter = getterFn(key, this.$options.asyncComputed[key]);
            this.$options.computed[prefix + key] = getter;
          }

          this.$options.data = function vueAsyncComputedInjectedDataFn() {
            var data = (typeof optionData === 'function' ? optionData.call(this) : optionData) || {};
            for (var _key in asyncComputed) {
              var item = this.$options.asyncComputed[_key];
              if (isComputedLazy(item)) {
                initLazy(data, _key);
                this.$options.computed[_key] = makeLazyComputed(_key);
              } else {
                data[_key] = null;
              }
            }
            return data;
          };
        },
        created: function created() {
          var _this2 = this;

          for (var key in this.$options.asyncComputed || {}) {
            var item = this.$options.asyncComputed[key],
                value = generateDefault.call(this, item, pluginOptions);
            if (isComputedLazy(item)) {
              silentSetLazy(this, key, value);
            } else {
              this[key] = value;
            }
          }

          var _loop = function _loop(_key2) {
            var promiseId = 0;
            var watcher = function watcher(newPromise) {
              var thisPromise = ++promiseId;

              if (newPromise === DidNotUpdate) {
                return;
              }

              if (!newPromise || !newPromise.then) {
                newPromise = Promise.resolve(newPromise);
              }
              setAsyncState(_this2, _key2, 'updating');

              newPromise.then(function (value) {
                if (thisPromise !== promiseId) return;
                setAsyncState(_this2, _key2, 'success');
                _this2[_key2] = value;
              }).catch(function (err) {
                if (thisPromise !== promiseId) return;

                setAsyncState(_this2, _key2, 'error');
                Vue.set(_this2.$data._asyncComputed[_key2], 'exception', err);
                if (pluginOptions.errorHandler === false) return;

                var handler = pluginOptions.errorHandler === undefined ? console.error.bind(console, 'Error evaluating async computed property:') : pluginOptions.errorHandler;

                if (pluginOptions.useRawError) {
                  handler(err);
                } else {
                  handler(err.stack);
                }
              });
            };
            Vue.set(_this2.$data._asyncComputed, _key2, {
              exception: null,
              update: function update() {
                watcher(getterOnly(_this2.$options.asyncComputed[_key2]).apply(_this2));
              }
            });
            setAsyncState(_this2, _key2, 'updating');
            _this2.$watch(prefix + _key2, watcher, { immediate: true });
          };

          for (var _key2 in this.$options.asyncComputed || {}) {
            _loop(_key2);
          }
        }
      });
    }
  };

  function setAsyncState(vm, stateObject, state) {
    vm.$set(vm.$data._asyncComputed[stateObject], 'state', state);
    vm.$set(vm.$data._asyncComputed[stateObject], 'updating', state === 'updating');
    vm.$set(vm.$data._asyncComputed[stateObject], 'error', state === 'error');
    vm.$set(vm.$data._asyncComputed[stateObject], 'success', state === 'success');
  }

  function getterOnly(fn) {
    if (typeof fn === 'function') return fn;

    return fn.get;
  }

  function getterFn(key, fn) {
    if (typeof fn === 'function') return fn;

    var getter = fn.get;

    if (fn.hasOwnProperty('watch')) {
      var previousGetter = getter;
      getter = function getter() {
        fn.watch.call(this);
        return previousGetter.call(this);
      };
    }

    if (fn.hasOwnProperty('shouldUpdate')) {
      var _previousGetter = getter;
      getter = function getter() {
        if (fn.shouldUpdate.call(this)) {
          return _previousGetter.call(this);
        }
        return DidNotUpdate;
      };
    }

    if (isComputedLazy(fn)) {
      var nonLazy = getter;
      getter = function lazyGetter() {
        if (isLazyActive(this, key)) {
          return nonLazy.call(this);
        } else {
          return silentGetLazy(this, key);
        }
      };
    }
    return getter;
  }

  function generateDefault(fn, pluginOptions) {
    var defaultValue = null;

    if ('default' in fn) {
      defaultValue = fn.default;
    } else if ('default' in pluginOptions) {
      defaultValue = pluginOptions.default;
    }

    if (typeof defaultValue === 'function') {
      return defaultValue.call(this);
    } else {
      return defaultValue;
    }
  }

  function install() {
    if (typeof window !== 'undefined' && window.Vue && window.Vue.use) {
      window.Vue.use(AsyncComputed);
    } else if (vueInstance) {
      vueInstance.use(AsyncComputed);
    }
  }
  function register(Vue) {
    vueInstance = Vue;
  }

  exports.default = AsyncComputed;
  exports.install = install;
  exports.register = register;

  Object.defineProperty(exports, '__esModule', { value: true });
});
