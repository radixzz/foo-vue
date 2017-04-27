import Vue from "vue";
import Signal from "signals";
import request from "superagent";
import throttle from "lodash/throttle";
import store from "app/store";
import Analytics from "foo/utils/Analytics";

import {LOCALE_CHANGED, LOCALE_LOADING} from "app/store/modules/app";

export default class AbstractApp {
    /**
     * Signal dispatching on app animationFrame
     * @property rendered
     * @type {Signal}
     */
    rendered = new Signal();

    /**
     * Signal dispatching on ap resize
     * @property resized
     * @type {Signal}
     */
    resized = new Signal();

    /**
     * The app debug flag
     * @property DEBUG
     * @type {boolean}
     */
    DEBUG;

    /**
     * The app config object
     * @property config
     * @type {Object}
     */
    config;

    /**
     * The app analytics util
     * @property analytics
     * @type {Analytics}
     */
    analytics;

    /**
     * App environment object
     * @property environment
     * @type {Object}
     */
    environment;

    /**
     * App initial load data
     * @default {}
     * @property data
     * @type {Object}
     */
    data;

    /**
     *  Defines if the App has started
     *  @property started
     *  @default false
     *  @type {boolean}
     */
    started = false;

    /**
     * The app window width
     * @property width
     * @type {Number}
     */
    width = window.innerWidth;

    /**
     * The app window height
     * @property height
     * @type {Number}
     */
    height = window.innerHeight;

    /**
     * The current locale
     * @default "es-MX"
     * @property locale
     * @type {string}
     */
    activeLocale;

    /**
     * App locales loaded
     * @type {Array}
     */
    loadedLocaleArr = [];

    /**
     * @module foo
     * @namespace core
     * @class AbstractApp
     * @author Mendieta
     * @constructor
     * @param {object} config App config object
     * @param {object} environment App environment object
     * @param {object} [data={}] App initial load data
     */
    constructor(config, environment, data = {}) {
        // Define props from arguments
        this.DEBUG = environment.vars.debug;
        this.config = config;
        this.environment = environment;
        this.data = data;
        this.activeLocale = config.locale;
        Promise
            .all([
                this._setupAnalytics(),
                this._loadLocale(),
            ])
            .then(() => {
                this._addListeners();
                this.start();
            });
    }

    /**
     * Method that set the current locale
     * @protected
     * @method setLocale
     * @param {string} localeId - The locale to set as active
     * @returns {void}
     */
    setLocale = localeId => {
        this._loadLocale(localeId);
    }

    /**
     * Starts App, override if needed custom initialization.
     * @protected
     * @method start
     * @returns {void}
     */
    start() {
        this.started = true;
        this.renderApp();
    }

    /**
     * Method to be overridden, render logic
     * @abstract
     * @method renderApp
     * @returns {void}
     */
    renderApp() {
    }

    /**
     * Method that init the Analytics helper
     * @private
     * @method _setupAnalytics
     * @returns {Promise}
     */
    _setupAnalytics() {
        const {config} = this;
        return new Promise(resolve => {
            this.analytics = new Analytics(
                "static/data/tracking.json",
                config.analytics,
                resolve);
        });
    }

    /**
     * Method that loads the current locale and (re)renders the App
     * @private
     * @param {string=} localeId - locale to load
     * @returns {Promise}
     */
    _loadLocale(localeId = this.config.locale) {
        const {loadedLocaleArr} = this;
        let promise;
        if (loadedLocaleArr.includes(localeId)) {
            // If locale is already loaded just resolve
            promise = Promise.resolve();
        } else {
            // Update store
            store.commit(LOCALE_LOADING);
            // Load requested json
            promise = request
                .get(`static/data/locale/${localeId}.json`)
                .catch(error => console.error("Failed to load locale:", error))
                .then(response => {
                    // Save locale in loaded arr
                    this.loadedLocaleArr.push(localeId);
                    // Save locale in vue
                    Vue.locale(localeId, response.body);
                });
        }
        // Return promise, update locale when resolved.
        return promise
            .then(() => this._updateLocale(localeId));
    }

    /**
     * Updates active locale
     * @private
     * @param {string} localeId - The locale to set as active
     * @return {void}
     */
    _updateLocale(localeId) {
        this.activeLocale = localeId;
        Vue.config.lang = localeId;
        store.commit(LOCALE_CHANGED, localeId);
    }

    /**
     * Method that init listeners depending on the App config
     * @private
     * @method _addListeners
     * @returns {void}
     */
    _addListeners() {
        if (this.config.vars.resize) window.addEventListener("resize", this._onResize);
        if (this.config.vars.animate) this._animate();
    }

    /**
     * Window resize event handler
     * @param {Event} e The event object
     * @private
     * @method _onResize
     * @returns {void}
     */
    _onResize = throttle(() => {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.resized.dispatch({width: this.width, height: this.height});
    }, 16);

    /**
     * Method that loops animation frameworks
     * @private
     * @method _animate
     * @returns {void}
     */
    _animate() {
        requestAnimationFrame(() => {
            this.rendered.dispatch();
            this._animate();
        });
    }
}
