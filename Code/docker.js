/*!
 * Web Cabin Docker - Docking Layout Interface.
 *
 * Dependencies:
 *  JQuery 1.11.1
 *  JQuery-contextMenu 1.6.6
 *  font-awesome 4.2.0
 *
 * Author: Jeff Houde (lochemage@webcabin.org)
 * Web: https://docker.webcabin.org/
 *
 * Licensed under
 *   MIT License http://www.opensource.org/licenses/mit-license
 *   GPL v3 http://opensource.org/licenses/GPL-3.0
 *
 */

/**
 * @class
 * The main docker instance.  This manages all of the docking panels and user input.
 * There should only be one instance of this, although it is not enforced.<br>
 * See {@tutorial getting-started}
 * 
 * @constructor
 * @param {external:jQuery~selector|external:jQuery~Object|external:domNode} container - A container element to store the contents of wcDocker.
 * @param {wcDocker~Options} [options] - Options for constructing the instance.
 */
function wcDocker(container, options) {
  this.$outer = $(container);
  this.$container = $('<div class="wcDocker">');
  this.$transition = $('<div class="wcDockerTransition">');

  this.$outer.append(this.$container);
  this.$container.append(this.$transition);

  this._canOrientTabs = true;

  this._events = {};

  this._root = null;
  this._frameList = [];
  this._floatingList = [];
  this._modalList = [];
  this._focusFrame = null;
  this._placeholderPanel = null;
  this._contextTimer = 0;
  this._dirty = false;

  this._splitterList = [];
  this._tabList = [];
  this._collapser = {};

  this._dockPanelTypeList = [];

  this._creatingPanel = false;
  this._draggingSplitter = null;
  this._draggingFrame = null;
  this._draggingFrameSizer = null;
  this._draggingFrameTab = null;
  this._draggingFrameTopper = false;
  this._draggingCustomTabFrame = null;
  this._ghost = null;
  this._menuTimer = 0;
  this._mouseOrigin = {x: 0, y: 0};

  this._resizeData = {
    time: -1,
    timeout: false,
    delta: 150,
  };

  var defaultOptions = {
    themePath: 'Themes',
    theme: 'default',
    allowContextMenu: true,
    hideOnResize: false,
    allowCollapse: true,
    responseRate: 10
  };

  this._options = {};
  for (var prop in defaultOptions) {
    this._options[prop] = defaultOptions[prop];
  }
  for (var prop in options) {
    this._options[prop] = options[prop];
  }

  this.__init();
};

/**
 * Enumerated Docking positions.
 * @version 3.0.0
 * @enum {String}
 */
wcDocker.DOCK = {
  /** A floating panel that blocks input until closed */
  MODAL                 : 'modal',
  /** A floating panel */
  FLOAT                 : 'float',
  /** Docks to the top of a target or window */
  TOP                   : 'top',
  /** Docks to the left of a target or window */
  LEFT                  : 'left',
  /** Docks to the right of a target or window */
  RIGHT                 : 'right',
  /** Docks to the bottom of a target or window */
  BOTTOM                : 'bottom',
  /** Docks as another tabbed item along with the target */
  STACKED               : 'stacked'
};

/**
 * Enumerated Internal events
 * @version 3.0.0
 * @enum {String}
 */
wcDocker.EVENT = {
  /** When the panel is initialized */ 
  INIT                 : 'panelInit',
  /** When the panel is updated */
  UPDATED              : 'panelUpdated',
  /** When the panel has changed its visibility */
  VISIBILITY_CHANGED   : 'panelVisibilityChanged',
  /** When the user begins moving any panel from its current docked position */
  BEGIN_DOCK           : 'panelBeginDock',
  /** When the user finishes moving or docking a panel */
  END_DOCK             : 'panelEndDock',
  /** When the user brings this panel into focus */
  GAIN_FOCUS           : 'panelGainFocus',
  /** When the user leaves focus on this panel */
  LOST_FOCUS           : 'panelLostFocus',
  /** When the panel is being closed */
  CLOSED               : 'panelClosed',
  /** When a custom button is clicked, See [wcPanel.addButton]{@link wcPanel#addButton} */
  BUTTON               : 'panelButton',
  /** When the panel has moved from floating to a docked position */
  ATTACHED             : 'panelAttached',
  /** When the panel has moved from a docked position to floating */
  DETACHED             : 'panelDetached',
  /** When the user has started moving the panel (top-left coordinates changed) */
  MOVE_STARTED         : 'panelMoveStarted',
  /** When the user has finished moving the panel */
  MOVE_ENDED           : 'panelMoveEnded',
  /** When the top-left coordinates of the panel has changed */
  MOVED                : 'panelMoved',
  /** When the user has started resizing the panel (width or height changed) */
  RESIZE_STARTED       : 'panelResizeStarted',
  /** When the user has finished resizing the panel */
  RESIZE_ENDED         : 'panelResizeEnded',
  /** When the panels width or height has changed */
  RESIZED              : 'panelResized',
  /** When the contents of the panel has been scrolled */
  SCROLLED             : 'panelScrolled',
  /** When the layout is being saved, See [wcDocker.save]{@link wcDocker#save} */
  SAVE_LAYOUT          : 'layoutSave',
  /** When the layout is being restored, See [wcDocker.restore]{@link wcDocker#restore} */
  RESTORE_LAYOUT       : 'layoutRestore',
  /** When the current tab on a custom tab widget associated with this panel has changed, See {@link wcTabFrame} */
  CUSTOM_TAB_CHANGED   : 'customTabChanged',
  /** When a tab has been closed on a custom tab widget associated with this panel, See {@link wcTabFrame} */
  CUSTOM_TAB_CLOSED    : 'customTabClosed'
};

/**
 * The name of the placeholder panel.
 * @constant {String}
 */
wcDocker.PANEL_PLACEHOLDER = '__wcDockerPlaceholderPanel';

/**
 * Used when [adding]{@link wcDocker#addPanel} or [moving]{@link wcDocker#movePanel} a panel to designate the target location as collapsed.<br>
 * Must be used with [docking]{@link wcDocker.DOCK} positions LEFT, RIGHT, or BOTTOM only.
 * @constant {String}
 */
wcDocker.COLLAPSED = '__wcDockerCollapsedPanel';

/**
 * Used for the splitter bar orientation.
 * @version 3.0.0
 * @enum {Boolean}
 */
wcDocker.ORIENTATION = {
  /** Top and Bottom panes */
  VERTICAL       : false,
  /** Left and Right panes */
  HORIZONTAL     : true
};

/**
 * Used to determine the position of tabbed widgets for stacked panels.<br>
 * <b>Note:</b> Not supported on IE8 or below.
 * @version 3.0.0
 * @enum {String}
 */
wcDocker.TAB = {
  /** The default, puts tabs at the top of the frame */
  TOP     : 'top',
  /** Puts tabs on the left side of the frame */
  LEFT    : 'left',
  /** Puts tabs on the right side of the frame */
  RIGHT   : 'right',
  /** Puts tabs on the bottom of the frame */
  BOTTOM  : 'bottom'
}

wcDocker.prototype = {
///////////////////////////////////////////////////////////////////////////////////////////////////////
// Public Functions
///////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Gets, or Sets the path where all theme files can be found.
   * "Themes" is the default folder path.
   *
   * @param {String} path - If supplied, will set the path where all themes can be found.
   *
   * @returns {String} - The currently assigned path.
   */
  themePath: function(path) {
    if (path !== undefined) {
      this._options.themePath = path;
    }
    return this._options.themePath;
  },

  /**
   * Gets, or Sets the current theme used by docker.
   *
   * @param {String} themeName - If supplied, will activate a theme with the given name.
   *
   * @returns {String} - The currently active theme.
   */
  theme: function(themeName) {
    if (themeName !== undefined) {
      var $oldTheme = $('#wcTheme');

      // The default theme requires no additional theme css file.
      var cacheBreak = (new Date()).getTime();
      var ext = themeName.indexOf('.css');
      if (ext > -1) {
        themeName = themeName.substring(0, ext);
      }
      var $link = $('<link id="wcTheme" rel="stylesheet" type="text/css" href="' + this._options.themePath + '/' + themeName + '.css?v=' + cacheBreak + '"/>');
      this._options.theme = themeName;

      var self = this;
      $link[0].onload = function() {
        $oldTheme.remove();
        self.__update();
      }

      $('head').append($link);
    }

    return this._options.theme;
  },

  /**
   * Retrieves whether panel collapsers are enabled.
   * @version 3.0.0
   * 
   * @returns {Boolean} - Collapsers are enabled.
   */
  isCollapseEnabled: function() {
    return (this._canOrientTabs && this._options.allowCollapse);
  },

  /**
   * Registers a new docking panel type to be used later.
   * @version 3.0.0
   *
   * @param {String} name                       - The name identifier for the new panel type.
   * @param {wcDocker~registerOptions} options  - An options object for describing the panel type.
   * @param {Boolean} [isPrivate]               - <b>DEPRECATED:</b> Use [options]{@link wcDocker~registerOptions} instead.
   *
   * @returns {Boolean} - Success or failure. Failure usually indicates the type name already exists.
   */
  registerPanelType: function(name, optionsOrCreateFunc, isPrivate) {

    var options = optionsOrCreateFunc;
    if (typeof options === 'function') {
      options = {
        onCreate: optionsOrCreateFunc,
      };
      console.log("WARNING: Passing in the creation function directly to wcDocker.registerPanelType parameter 2 is now deprecated and will be removed in the next version!  Please use the preferred options object instead.");
    }

    if (typeof isPrivate != 'undefined') {
      options.isPrivate = isPrivate;
      console.log("WARNING: Passing in the isPrivate flag to wcDocker.registerPanelType parameter 3 is now deprecated and will be removed in the next version!  Please use the preferred options object instead.");
    }

    if ($.isEmptyObject(options)) {
      options = null;
    }

    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name === name) {
        return false;
      }
    }

    this._dockPanelTypeList.push({
      name: name,
      options: options,
    });

    var $menu = $('menu').find('menu');
    $menu.append($('<menuitem label="' + name + '">'));
    return true;
  },

  /**
   * Retrieves a list of all currently registered panel types.
   *
   * @param {Boolean} includePrivate - If true, panels registered as private will also be included with this list.
   *
   * @returns {String[]} - A list of panel type names.
   */
  panelTypes: function(includePrivate) {
    var result = [];
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (includePrivate || !this._dockPanelTypeList[i].options.isPrivate) {
        result.push(this._dockPanelTypeList[i].name);
      }
    }
    return result;
  },

  /**
   * Retrieves the options data associated with a given panel type when it was registered.
   *
   * @param {String} typeName - The name identifier of the panel.
   *
   * @returns {wcDocker~registerOptions} - Registered options of the panel type, or false if the panel was not found.
   */
  panelTypeInfo: function(typeName) {
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name == typeName) {
        return this._dockPanelTypeList[i].options;
      }
    }
    return false;
  },

  /**
   * Add a new docked panel to the docker instance.<br>
   * <b>Note:</b> It is best to use {@link wcDocker.COLLAPSED} after you have added your other docked panels, as it may ensure proper placement.
   *
   * @param {String} typeName                           - The name identifier of the panel to create.
   * @param {wcDocker.DOCK} location                    - The docking location to place this panel.
   * @param {wcPanel|wcDocker.COLLAPSED} [targetPanel]  - A target panel to dock relative to, or use {@link wcDocker.COLLAPSED} to collapse it to the side or bottom.
   * @param {wcDocker~PanelOptions} [options]           - Other options for panel placement.
   *
   * @returns {wcPanel|Boolean} - The newly created panel object, or false if no panel was created.
   */
  addPanel: function(typeName, location, targetPanel, options) {
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name === typeName) {
        var panelType = this._dockPanelTypeList[i];
        var panel = new wcPanel(typeName, panelType.options);
        panel._parent = this;
        panel.__container(this.$transition);
        var panelOptions = (panelType.options && panelType.options.options) || {};
        panel._panelObject = new panelType.options.onCreate(panel, panelOptions);

        if (location === wcDocker.DOCK.STACKED) {
          this.__addPanelGrouped(panel, targetPanel, options);
        } else {
          this.__addPanelAlone(panel, location, targetPanel, options);
        }

        if (this._placeholderPanel && panel.moveable() &&
            location !== wcDocker.DOCK.FLOAT &&
            location !== wcDocker.DOCK.MODAL) {
          if (this.removePanel(this._placeholderPanel)) {
            this._placeholderPanel = null;
          }
        }

        this.__forceUpdate();
        return panel;
      }
    }
    return false;
  },

  /**
   * Removes a docked panel from the window.
   *
   * @param {wcPanel} panel - The panel to remove.
   *
   * @returns {Boolean} - Success or failure.
   */
  removePanel: function(panel) {
    if (!panel) {
      return false;
    }

    // Do not remove if this is the last moveable panel.
    var lastPanel = this.__isLastPanel(panel);

    var parentFrame = panel._parent;
    if (parentFrame instanceof wcFrame) {
      panel.__trigger(wcDocker.EVENT.CLOSED);

      // If no more panels remain in this frame, remove the frame.
      if (!parentFrame.removePanel(panel) && !parentFrame.isCollapser()) {
        // If this is the last frame, create a dummy panel to take up
        // the space until another one is created.
        if (lastPanel) {
          this.__addPlaceholder(parentFrame);
          return true;
        }

        var index = this._floatingList.indexOf(parentFrame);
        if (index !== -1) {
          this._floatingList.splice(index, 1);
        }
        index = this._frameList.indexOf(parentFrame);
        if (index !== -1) {
          this._frameList.splice(index, 1);
        }
        index = this._modalList.indexOf(parentFrame);
        if (index !== -1) {
          this._modalList.splice(index, 1);
        }

        if (this._modalList.length) {
          this.__focus(this._modalList[this._modalList.length-1]);
        } else if (this._floatingList.length) {
          this.__focus(this._floatingList[this._floatingList.length-1]);
        }

        var parentSplitter = parentFrame._parent;
        if (parentSplitter instanceof wcSplitter) {
          parentSplitter.__removeChild(parentFrame);

          var other;
          if (parentSplitter.pane(0)) {
            other = parentSplitter.pane(0);
            parentSplitter._pane[0] = null;
          } else {
            other = parentSplitter.pane(1);
            parentSplitter._pane[1] = null;
          }

          // Keep the panel in a hidden transition container so as to not
          // destroy any event handlers that may be on it.
          other.__container(this.$transition);
          other._parent = null;

          index = this._splitterList.indexOf(parentSplitter);
          if (index !== -1) {
            this._splitterList.splice(index, 1);
          }

          var parent = parentSplitter._parent;
          parentContainer = parentSplitter.__container();
          parentSplitter.__destroy();

          if (parent instanceof wcSplitter) {
            parent.__removeChild(parentSplitter);
            if (!parent.pane(0)) {
              parent.pane(0, other);
            } else {
              parent.pane(1, other);
            }
          } else if (parent === this) {
            this._root = other;
            other._parent = this;
            other.__container(parentContainer);
          }
          this.__update();
        } else if (parentFrame === this._root) {
          this._root = null;
        }

        if (this._focusFrame === parentFrame) {
          this._focusFrame = null;
        }
        parentFrame.__destroy();
      }
      panel.__destroy();
      return true;
    }
    return false;
  },

  /**
   * Moves a docking panel from its current location to another.
   *
   * @param {wcPanel} panel                             - The panel to move.
   * @param {wcDocker.DOCK} location                    - The new docking location of the panel.
   * @param {wcPanel|wcDocker.COLLAPSED} [targetPanel]  - A target panel to dock relative to, or use {@link wcDocker.COLLAPSED} to collapse it to the side or bottom.
   * @param {wcDocker~PanelOptions} [options]           - Other options for panel placement.
   *
   * @returns {wcPanel|Boolean} - The panel that was created, or false on failure.
   */
  movePanel: function(panel, location, targetPanel, options) {
    var lastPanel = this.__isLastPanel(panel);

    var $elem = panel.$container;
    if (panel._parent instanceof wcFrame) {
      $elem = panel._parent.$frame;
    }
    var offset = $elem.offset();
    var width  = $elem.width();
    var height = $elem.height();

    var parentFrame = panel._parent;
    var floating = false;
    if (parentFrame instanceof wcFrame) {
      floating = parentFrame._isFloating;
      // Remove the panel from the frame.
      for (var i = 0; i < parentFrame._panelList.length; ++i) {
        if (parentFrame._panelList[i] === panel) {
          if (parentFrame.isCollapser()) {
            parentFrame._curTab = -1;
          } else if (parentFrame._curTab >= i) {
            parentFrame._curTab--;
          }

          // Keep the panel in a hidden transition container so as to not
          // destroy any event handlers that may be on it.
          panel.__container(this.$transition);
          panel._parent = null;

          parentFrame._panelList.splice(i, 1);
          break;
        }
      }

      if (!parentFrame.isCollapser() && parentFrame._curTab === -1 && parentFrame._panelList.length) {
        parentFrame._curTab = 0;
      }

      parentFrame.__updateTabs();
      parentFrame.collapse();
      
      // If no more panels remain in this frame, remove the frame.
      if (!parentFrame.isCollapser() && parentFrame._panelList.length === 0) {
        // If this is the last frame, create a dummy panel to take up
        // the space until another one is created.
        if (lastPanel) {
          this.__addPlaceholder(parentFrame);
        } else {
          var index = this._floatingList.indexOf(parentFrame);
          if (index !== -1) {
            this._floatingList.splice(index, 1);
          }
          index = this._frameList.indexOf(parentFrame);
          if (index !== -1) {
            this._frameList.splice(index, 1);
          }

          var parentSplitter = parentFrame._parent;
          if (parentSplitter instanceof wcSplitter) {
            parentSplitter.__removeChild(parentFrame);

            var other;
            if (parentSplitter.pane(0)) {
              other = parentSplitter.pane(0);
              parentSplitter._pane[0] = null;
            } else {
              other = parentSplitter.pane(1);
              parentSplitter._pane[1] = null;
            }

            // Keep the item in a hidden transition container so as to not
            // destroy any event handlers that may be on it.
            other.__container(this.$transition);
            other._parent = null;

            index = this._splitterList.indexOf(parentSplitter);
            if (index !== -1) {
              this._splitterList.splice(index, 1);
            }

            var parent = parentSplitter._parent;
            parentContainer = parentSplitter.__container();
            parentSplitter.__destroy();

            if (parent instanceof wcSplitter) {
              parent.__removeChild(parentSplitter);
              if (!parent.pane(0)) {
                parent.pane(0, other);
              } else {
                parent.pane(1, other);
              }
            } else if (parent === this) {
              this._root = other;
              other._parent = this;
              other.__container(parentContainer);
            }
            this.__update();
          }

          if (this._focusFrame === parentFrame) {
            this._focusFrame = null;
          }

          parentFrame.__destroy();
        }
      }
    }

    panel.initSize(width, height);
    if (location === wcDocker.DOCK.STACKED) {
      this.__addPanelGrouped(panel, targetPanel, options);
    } else {
      this.__addPanelAlone(panel, location, targetPanel, options);
    }

    if (targetPanel == this._placeholderPanel) {
      this.removePanel(this._placeholderPanel);
      this._placeholderPanel = null;
    }

    var frame = panel._parent;
    if (frame instanceof wcFrame) {
      if (frame._panelList.length === 1) {
        frame.pos(offset.left + width/2 + 20, offset.top + height/2 + 20, true);
      }
    }

    this.__update(true);

    if (frame instanceof wcFrame) {
      if (floating !== frame._isFloating) {
        if (frame._isFloating) {
          panel.__trigger(wcDocker.EVENT.DETACHED);
        } else {
          panel.__trigger(wcDocker.EVENT.ATTACHED);
        }
      }
    }

    panel.__trigger(wcDocker.EVENT.MOVED);
    return panel;
  },

  /**
   * Finds all instances of a given panel type.
   *
   * @param {String} [typeName] - The name identifier for the panel. If not supplied, all panels are retrieved.
   *
   * @returns {wcPanel[]} - A list of all panels found of the given type.
   */
  findPanels: function(typeName) {
    var result = [];
    for (var i = 0; i < this._frameList.length; ++i) {
      var frame = this._frameList[i];
      for (var a = 0; a < frame._panelList.length; ++a) {
        var panel = frame._panelList[a];
        if (!typeName || panel._type === typeName) {
          result.push(panel);
        }
      }
    }

    return result;
  },

  /**
   * Registers a global [event]{@link wcDocker.EVENT}.
   *
   * @param {wcDocker.EVENT} eventType        - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {wcDocker~event:onEvent} handler  - A handler function to be called for the event.
   *
   * @returns {Boolean} Success or failure that the event has been registered.
   */
  on: function(eventType, handler) {
    if (!eventType) {
      return false;
    }

    if (!this._events[eventType]) {
      this._events[eventType] = [];
    }

    if (this._events[eventType].indexOf(handler) !== -1) {
      return false;
    }

    this._events[eventType].push(handler);
    return true;
  },

  /**
   * Unregisters a global [event]{@link wcDocker.EVENT}.
   *
   * @param {wcDocker.EVENT} eventType          - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {wcDocker~event:onEvent} [handler]  - The handler function registered with the event. If omitted, all events registered to the event type are unregistered.
   */
  off: function(eventType, handler) {
    if (typeof eventType === 'undefined') {
      this._events = {};
      return;
    } else {
      if (this._events[eventType]) {
        if (typeof handler === 'undefined') {
          this._events[eventType] = [];
        } else {
          for (var i = 0; i < this._events[eventType].length; ++i) {
            if (this._events[eventType][i] === handler) {
              this._events[eventType].splice(i, 1);
              break;
            }
          }
        }
      }
    }
  },

  /**
   * Trigger an [event]{@link wcDocker.EVENT} on all panels.
   * @fires wcDocker~event:onEvent
   *
   * @param {wcDocker.EVENT} eventType  - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {Object} [data]             - A custom data object to be passed along with the event.
   */
  trigger: function(eventName, data) {
    if (!eventName) {
      return false;
    }

    for (var i = 0; i < this._frameList.length; ++i) {
      var frame = this._frameList[i];
      for (var a = 0; a < frame._panelList.length; ++a) {
        var panel = frame._panelList[a];
        panel.__trigger(eventName, data);
      }
    }

    this.__trigger(eventName, data);
  },

  /**
   * Assigns a basic context menu to a selector element.  The context
   * Menu is a simple list of options, no nesting or special options.<br><br>
   *
   * If you wish to use a more complex context menu, you can use
   * [jQuery.contextMenu]{@link http://medialize.github.io/jQuery-contextMenu/docs.html} directly.
   * @deprecated Renamed to [wcDocker.menu}{@link wcDocker#menu}.
   *
   * @param {external:jQuery~selector} selector                               - A selector string that designates the elements who use this menu.
   * @param {external:jQuery#contextMenu~item[]|Function} itemListOrBuildFunc - An array with each context menu item in it, or a function to call that returns one.
   * @param {Boolean} includeDefault                                          - If true, all default menu options will be included.
   */
  basicMenu: function(selector, itemListOrBuildFunc, includeDefault) {
    console.log('WARNING: wcDocker.basicMenu is deprecated, please use wcDocker.menu instead.');
    this.menu(selector, itemListOrBuildFunc, includeDefault);
  },

  /**
   * Assigns a basic context menu to a selector element.  The context
   * Menu is a simple list of options, no nesting or special options.<br><br>
   *
   * If you wish to use a more complex context menu, you can use
   * [jQuery.contextMenu]{@link http://medialize.github.io/jQuery-contextMenu/docs.html} directly.
   *
   * @param {external:jQuery~selector} selector                               - A selector string that designates the elements who use this menu.
   * @param {external:jQuery#contextMenu~item[]|Function} itemListOrBuildFunc - An array with each context menu item in it, or a function to call that returns one.
   * @param {Boolean} includeDefault                                          - If true, all default menu options will be included.
   */
  menu: function(selector, itemListOrBuildFunc, includeDefault) {
    var self = this;
    $.contextMenu({
      selector: selector,
      build: function($trigger, event) {
        var mouse = self.__mouse(event);
        var myFrame;
        for (var i = 0; i < self._frameList.length; ++i) {
          var $frame = $trigger.hasClass('wcFrame') && $trigger || $trigger.parents('.wcFrame');
          if (self._frameList[i].$frame[0] === $frame[0]) {
            myFrame = self._frameList[i];
            break;
          }
        }

        var isTitle = false;
        if ($(event.target).hasClass('wcTabScroller')) {
          isTitle = true;
        }

        var windowTypes = {};
        for (var i = 0; i < self._dockPanelTypeList.length; ++i) {
          var type = self._dockPanelTypeList[i];
          if (!type.options.isPrivate) {
            if (type.options.limit > 0) {
              if (self.findPanels(type.name).length >= type.options.limit) {
                continue;
              }
            }
            var icon = null;
            var faicon = null;
            var label = type.name;
            if (type.options) {
              if (type.options.faicon) {
                faicon = type.options.faicon;
              }
              if (type.options.icon) {
                icon = type.options.icon;
              }
              if (type.options.title) {
                label = type.options.title;
              }
            }
            windowTypes[type.name] = {
              name: label,
              icon: icon,
              faicon: faicon,
              className: 'wcMenuCreatePanel',
            };
          }
        }

        var separatorIndex = 0;
        var finalItems = {};
        var itemList = itemListOrBuildFunc;
        if (typeof itemListOrBuildFunc === 'function') {
          itemList = itemListOrBuildFunc($trigger, event);
        }

        for (var i = 0; i < itemList.length; ++i) {
          if ($.isEmptyObject(itemList[i])) {
            finalItems['sep' + separatorIndex++] = "---------";
            continue;
          }

          var callback = itemList[i].callback;
          if (callback) {
            (function(listItem, callback) {
              listItem.callback = function(key, opts) {
                var panel = null;
                var $frame = opts.$trigger.parents('.wcFrame').first();
                if ($frame.length) {
                  for (var a = 0; a < self._frameList.length; ++a) {
                    if ($frame[0] === self._frameList[a].$frame[0]) {
                      panel = self._frameList[a].panel();
                    }
                  }
                }

                callback(key, opts, panel);
              };
            })(itemList[i], callback);
          }
          finalItems[itemList[i].name] = itemList[i];
        }

        var collapseTypes = {};
        var defaultCollapse = '';
        if (self.isCollapseEnabled()) {

          var $icon = myFrame.$collapse.children('div');
          if ($icon.hasClass('wcCollapseLeft')) {
            defaultCollapse = ' wcCollapseLeft';
          } else if ($icon.hasClass('wcCollapseRight')) {
            defaultCollapse = ' wcCollapseRight';
          } else {
            defaultCollapse = ' wcCollapseBottom';
          }

          collapseTypes[wcDocker.DOCK.LEFT] = {
            name: wcDocker.DOCK.LEFT,
            faicon: 'sign-in wcCollapseLeft wcCollapsible',
          };
          collapseTypes[wcDocker.DOCK.RIGHT] = {
            name: wcDocker.DOCK.RIGHT,
            faicon: 'sign-in wcCollapseRight wcCollapsible',
          };
          collapseTypes[wcDocker.DOCK.BOTTOM] = {
            name: wcDocker.DOCK.BOTTOM,
            faicon: 'sign-in wcCollapseBottom wcCollapsible',
          };
        }

        var items = finalItems;

        if (includeDefault) {
          if (!$.isEmptyObject(finalItems)) {
            items['sep' + separatorIndex++] = "---------";
          }

          if (isTitle) {
            items['Close Panel'] = {
              name: 'Remove Panel',
              faicon: 'close',
              disabled: !myFrame.panel().closeable(),
            };
            if (self.isCollapseEnabled()) {
              if (!myFrame.isCollapser()) {
                items.fold1 = {
                  name: 'Collapse Panel',
                  faicon: 'sign-in' + defaultCollapse + ' wcCollapsible',
                  items: collapseTypes,
                }
              } else {
                items['Attach Panel'] = {
                  name: 'Dock Panel',
                  faicon: 'sign-out' + defaultCollapse + ' wcCollapsed',
                }
              }
            }
            if (!myFrame._isFloating) {
              items['Detach Panel'] = {
                name: 'Float Panel',
                faicon: 'level-up',
                disabled: !myFrame.panel().moveable() || myFrame.panel()._isPlaceholder,
              };
            }

            items['sep' + separatorIndex++] = "---------";
    
            items.fold2 = {
              name: 'Add Panel',
              faicon: 'columns',
              items: windowTypes,
              disabled: !(myFrame.panel()._titleVisible && (!myFrame._isFloating || self._modalList.indexOf(myFrame) === -1)),
              className: 'wcMenuCreatePanel',
            };
          } else {
            if (myFrame) {
              items['Close Panel'] = {
                name: 'Remove Panel',
                faicon: 'close',
                disabled: !myFrame.panel().closeable(),
              };
              if (self.isCollapseEnabled()) {
                if (!myFrame.isCollapser()) {
                  items.fold1 = {
                    name: 'Collapse Panel',
                    faicon: 'sign-in' + defaultCollapse + ' wcCollapsible',
                    items: collapseTypes,
                  }
                } else {
                  items['Attach Panel'] = {
                    name: 'Dock Panel',
                    faicon: 'sign-out' + defaultCollapse + ' wcCollapsed',
                  }
                }
              }
              if (!myFrame._isFloating) {
                items['Detach Panel'] = {
                  name: 'Float Panel',
                  faicon: 'level-up',
                  disabled: !myFrame.panel().moveable() || myFrame.panel()._isPlaceholder,
                };
              }

              items['sep' + separatorIndex++] = "---------";
            }

            items.fold2 = {
              name: 'Add Panel',
              faicon: 'columns',
              items: windowTypes,
              disabled: !(!myFrame || (!myFrame._isFloating && myFrame.panel().moveable())),
              className: 'wcMenuCreatePanel',
            };
          }

          if (myFrame && !myFrame._isFloating && myFrame.panel().moveable()) {
            var rect = myFrame.__rect();
            self._ghost = new wcGhost(rect, mouse, self);
            myFrame.__checkAnchorDrop(mouse, false, self._ghost, true, false);
            self._ghost.$ghost.hide();
          }
        }

        return {
          callback: function(key, options) {
            if (key === 'Close Panel') {
              setTimeout(function() {
                myFrame.panel().close();
              }, 10);
            } else if (key === 'Detach Panel') {
              self.movePanel(myFrame.panel(), wcDocker.DOCK.FLOAT, false);
            } else if (key === 'Attach Panel') {
              var $icon = myFrame.$collapse.children('div');
              var position = wcDocker.DOCK.BOTTOM;
              if ($icon.hasClass('wcCollapseLeft')) {
                position = wcDocker.DOCK.LEFT;
              } else if ($icon.hasClass('wcCollapseRight')) {
                position = wcDocker.DOCK.RIGHT;
              }
              var opts = {};
              switch (position) {
                case wcDocker.DOCK.LEFT:
                  opts.w = myFrame.$frame.width();
                  break;
                case wcDocker.DOCK.RIGHT:
                  opts.w = myFrame.$frame.width();
                  break;
                case wcDocker.DOCK.BOTTOM:
                  opts.h = myFrame.$frame.height();
                  break;
              }
              var target = self._collapser[wcDocker.DOCK.LEFT]._parent.right();
              myFrame.collapse(true);
              self.movePanel(myFrame.panel(), position, target, opts);
            } else if (key === wcDocker.DOCK.LEFT) {
              self.movePanel(myFrame.panel(), wcDocker.DOCK.LEFT, wcDocker.COLLAPSED);
            } else if (key === wcDocker.DOCK.RIGHT) {
              self.movePanel(myFrame.panel(), wcDocker.DOCK.RIGHT, wcDocker.COLLAPSED);
            } else if (key === wcDocker.DOCK.BOTTOM) {
              self.movePanel(myFrame.panel(), wcDocker.DOCK.BOTTOM, wcDocker.COLLAPSED);
            } else {
              if (self._ghost && (myFrame)) {
                var anchor = self._ghost.anchor();
                var newPanel = self.addPanel(key, anchor.loc, myFrame.panel(), self._ghost.rect());
                newPanel.focus();
              }
            }
          },
          events: {
            show: function(opt) {
              (function(items){

                // Whenever them menu is shown, we update and add the faicons.
                // Grab all those menu items, and propogate a list with them.
                var menuItems = {};
                var options = opt.$menu.find('.context-menu-item');
                for (var i = 0; i < options.length; ++i) {
                  var $option = $(options[i]);
                  var $span = $option.find('span');
                  if ($span.length) {
                    menuItems[$span[0].innerHTML] = $option;
                  }
                }

                // function calls itself so that we get nice icons inside of menus as well.
                (function recursiveIconAdd(items) {
                  for(var it in items) {
                    var item = items[it];
                    var $menu = menuItems[item.name];

                    if ($menu) {
                      var $icon = $('<div class="wcMenuIcon">');
                      $menu.prepend($icon);

                      if (item.icon) {
                        $icon.addClass(item.icon);
                      }

                      if (item.faicon) {
                        $icon.addClass('fa fa-menu fa-' + item.faicon + ' fa-lg fa-fw');
                      }

                      // Custom submenu arrow.
                      if ($menu.hasClass('context-menu-submenu')) {
                        var $expander = $('<div class="wcMenuSubMenu fa fa-caret-right fa-lg">');
                        $menu.append($expander);
                      }
                    }

                    // Iterate through sub-menus.
                    if (item.items) {
                      recursiveIconAdd(item.items);
                    }
                  }
                })(items);

              })(items);
            },
            hide: function(opt) {
              if (self._ghost) {
                self._ghost.destroy();
                self._ghost = false;
              }
            },
          },
          animation: {duration: 250, show: 'fadeIn', hide: 'fadeOut'},
          reposition: false,
          autoHide: true,
          zIndex: 200,
          items: items,
        };
      },
    });
  },

  /**
   * Bypasses the next context menu event.
   * Use this during a mouse up event in which you do not want the
   * context menu to appear when it normally would have.
   */
  bypassMenu: function() {
    if (this._menuTimer) {
      clearTimeout(this._menuTimer);
    }

    for (var i in $.contextMenu.menus) {
      var menuSelector = $.contextMenu.menus[i].selector;
      $(menuSelector).contextMenu(false);
    }

    var self = this;
    this._menuTimer = setTimeout(function() {
      for (var i in $.contextMenu.menus) {
        var menuSelector = $.contextMenu.menus[i].selector;
        $(menuSelector).contextMenu(true);
      }
      self._menuTimer = null;
    }, 0);
  },

  /**
   * Saves the current panel configuration into a serialized
   * string that can be used later to restore it.
   *
   * @returns {String} - A serialized string that describes the current panel configuration.
   */
  save: function() {
    var data = {};

    data.floating = [];
    for (var i = 0; i < this._floatingList.length; ++i) {
      data.floating.push(this._floatingList[i].__save());
    }

    data.root = this._root.__save();

    if (!$.isEmptyObject(this._collapser)) {
      data.collapsers = {
        left:   this._collapser[wcDocker.DOCK.LEFT].__save(),
        right:  this._collapser[wcDocker.DOCK.RIGHT].__save(),
        bottom: this._collapser[wcDocker.DOCK.BOTTOM].__save(),
      };
    }
    
    return JSON.stringify(data, function(key, value) {
      if (value == Infinity) {
        return "Infinity";
      }
      return value;
    });
  },

  /**
   * Restores a previously saved configuration.
   *
   * @param {String} dataString - A previously saved serialized string, See [wcDocker.save]{@link wcDocker#save}.
   */
  restore: function(dataString) {
    var data = JSON.parse(dataString, function(key, value) {
      if (value === 'Infinity') {
        return Infinity;
      }
      return value;
    });

    this.clear();

    this._root = this.__create(data.root, this, this.$container);
    this._root.__restore(data.root, this);

    for (var i = 0; i < data.floating.length; ++i) {
      var panel = this.__create(data.floating[i], this, this.$container);
      panel.__restore(data.floating[i], this);
    }

    this.__forceUpdate(false);

    if (!$.isEmptyObject(data.collapsers) && this.isCollapseEnabled()) {
      this.__initCollapsers();

      this._collapser[wcDocker.DOCK.LEFT].__restore(data.collapsers.left, this);
      this._collapser[wcDocker.DOCK.RIGHT].__restore(data.collapsers.right, this);
      this._collapser[wcDocker.DOCK.BOTTOM].__restore(data.collapsers.bottom, this);

      var self = this;
      setTimeout(function() {self.__forceUpdate();});
    }
  },

  /**
   * Clears all contents from the docker instance.
   */
  clear: function() {
    this._root = null;

    // Make sure we notify all panels that they are closing.
    this.trigger(wcDocker.EVENT.CLOSED);

    for (var i = 0; i < this._splitterList.length; ++i) {
      this._splitterList[i].__destroy();
    }

    for (var i = 0; i < this._frameList.length; ++i) {
      this._frameList[i].__destroy();
    }

    if (!$.isEmptyObject(this._collapser)) {
      this._collapser[wcDocker.DOCK.LEFT].__destroy();
      this._collapser[wcDocker.DOCK.RIGHT].__destroy();
      this._collapser[wcDocker.DOCK.BOTTOM].__destroy();
      this._collapser = {};
    }

    while (this._frameList.length) this._frameList.pop();
    while (this._floatingList.length) this._floatingList.pop();
    while (this._splitterList.length) this._splitterList.pop();
  },


///////////////////////////////////////////////////////////////////////////////////////////////////////
// Private Functions
///////////////////////////////////////////////////////////////////////////////////////////////////////

  __init: function() {
    var self = this;

    this.__compatibilityCheck();

    this._root = null;
    this.__addPlaceholder();
    
    // Setup our context menus.
    if (this._options.allowContextMenu) {
      this.menu('.wcFrame', [], true);
    }

    this.theme(this._options.theme);

    // Set up our responsive updater.
    this._updateId = setInterval(function() {
      if (self._dirty) {
        self._dirty = false;
        if (self._root) {
          self._root.__update();
        }

        for (var i = 0; i < self._floatingList.length; ++i) {
          self._floatingList[i].__update();
        }
      }
    }, this._options.responseRate);

    $(window).resize(this.__resize.bind(this));
    $('body').on('contextmenu', 'a, img', __onContextShowNormal);
    $('body').on('contextmenu', '.wcSplitterBar', __onContextDisable);

    // $('body').on('selectstart', '.wcFrameTitleBar, .wcPanelTab, .wcFrameButton', function(event) {
    //   event.preventDefault();
    // });

    // Hovering over a panel creation context menu.
    $('body').on('mouseenter', '.wcMenuCreatePanel', __onEnterCreatePanel);
    $('body').on('mouseleave', '.wcMenuCreatePanel', __onLeaveCreatePanel);

    // Mouse move will allow you to move an object that is being dragged.
    $('body').on('mousemove', __onMouseMove);
    $('body').on('touchmove', __onMouseMove);
    // A catch all on mouse down to record the mouse origin position.
    $('body').on('mousedown', __onMouseDown);
    $('body').on('touchstart', __onMouseDown);
    $('body').on('mousedown', '.wcModalBlocker', __onMouseDownModalBlocker);
    $('body').on('touchstart', '.wcModalBlocker', __onMouseDownModalBlocker);
    // On some browsers, clicking and dragging a tab will drag it's graphic around.
    // Here I am disabling this as it interferes with my own drag-drop.
    $('body').on('mousedown', '.wcPanelTab', __onPreventDefault);
    $('body').on('touchstart', '.wcPanelTab', __onPreventDefault);
    $('body').on('mousedown', '.wcFrameButtonBar > .wcFrameButton', __onMouseSelectionBlocker);
    $('body').on('touchstart', '.wcFrameButtonBar > .wcFrameButton', __onMouseSelectionBlocker);
    // Mouse down on a frame title will allow you to move them.
    $('body').on('mousedown', '.wcFrameTitleBar', __onMouseDownFrameTitle);
    $('body').on('touchstart', '.wcFrameTitleBar', __onMouseDownFrameTitle);
    // Mouse down on a splitter bar will allow you to resize them.
    $('body').on('mousedown', '.wcSplitterBar', __onMouseDownSplitter);
    $('body').on('touchstart', '.wcSplitterBar', __onMouseDownSplitter);
    // Middle mouse button on a panel tab to close it.
    $('body').on('mousedown', '.wcPanelTab', __onMouseDownPanelTab);
    $('body').on('touchstart', '.wcPanelTab', __onMouseDownPanelTab);
    // Middle mouse button on a panel tab to close it.
    $('body').on('mouseup', '.wcPanelTab', __onReleasePanelTab);
    $('body').on('touchend', '.wcPanelTab', __onReleasePanelTab);
    // Mouse down on a panel will put it into focus.
    $('body').on('mousedown', '.wcLayout', __onMouseDownLayout);
    $('body').on('touchstart', '.wcLayout', __onMouseDownLayout);
    // Floating frames have resizable edges.
    $('body').on('mousedown', '.wcFrameEdge', __onMouseDownResizeFrame);
    $('body').on('touchstart', '.wcFrameEdge', __onMouseDownResizeFrame);
    // Create new panels.
    $('body').on('mousedown', '.wcCreatePanel', __onMouseDownCreatePanel);
    $('body').on('touchstart', '.wcCreatePanel', __onMouseDownCreatePanel);
    // Mouse released
    $('body').on('mouseup', __onMouseUp);
    $('body').on('touchend', __onMouseUp);

    // Clicking on a custom tab button.
    $('body').on('click', '.wcCustomTab .wcFrameButton', __onClickCustomTabButton);
    // Clicking on a panel frame button.
    $('body').on('click', '.wcFrameButtonBar > .wcFrameButton', __onClickPanelButton);

    // Escape key to cancel drag operations.
    $('body').on('keyup', __onKeyup);

    // on mousedown
    function __onMouseDown(event) {
      var mouse = self.__mouse(event);
      self._mouseOrigin.x = mouse.x;
      self._mouseOrigin.y = mouse.y;
    };

    // on mouseup
    function __onMouseUp(event) {
      var mouse = self.__mouse(event);
      if (mouse.which === 3) {
        return true;
      }
      self.$container.removeClass('wcDisableSelection');
      if (self._draggingFrame) {
        for (var i = 0; i < self._frameList.length; ++i) {
          self._frameList[i].__shadow(false);
        }
      }

      if (self._ghost && (self._draggingFrame || self._creatingPanel)) {
        var anchor = self._ghost.anchor();

        if (self._draggingFrame) {
          if (!anchor) {
            if (!self._draggingFrameTab) {
              self._draggingFrame.panel(0);
            }

            if (self._draggingFrameTab || !self.__isLastFrame(self._draggingFrame)) {
              var panel = self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.FLOAT, null, self._ghost.__rect());
              // Dragging the entire frame.
              if (!self._draggingFrameTab) {
                while (self._draggingFrame.panel()) {
                  self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.STACKED, panel, {tabOrientation: self._draggingFrame._tabOrientation});
                }
              }

              var frame = panel._parent;
              if (frame instanceof wcFrame) {
                frame.pos(mouse.x, mouse.y + self._ghost.__rect().h/2 - 10, true);

                frame._size.x = self._ghost.__rect().w;
                frame._size.y = self._ghost.__rect().h;
              }

              frame.__update();
              self.__focus(frame);
            }
          } else if (!anchor.self && anchor.loc !== undefined) {
            // Changing tab location on the same frame.
            if (anchor.tab && anchor.item._parent._parent == self._draggingFrame) {
              self._draggingFrame.tabOrientation(anchor.tab);
            } else {
              var index = self._draggingFrame._curTab;
              if (!self._draggingFrameTab) {
                self._draggingFrame.panel(0);
              }
              var panel;
              if (anchor.item) {
                panel = anchor.item._parent;
              }
              // If we are dragging a tab to split its own container, find another
              // tab item within the same frame and split from there.
              if (panel === self._draggingFrame.panel()) {
                // Can not split the frame if it is the only panel inside.
                if (self._draggingFrame._panelList.length === 1) {
                  return;
                }
                for (var i = 0; i < self._draggingFrame._panelList.length; ++i) {
                  if (panel !== self._draggingFrame._panelList[i]) {
                    panel = self._draggingFrame._panelList[i];
                    index--;
                    break;
                  }
                }
              }
              panel = self.movePanel(self._draggingFrame.panel(), anchor.loc, panel, self._ghost.rect());
              panel._parent.panel(panel._parent._panelList.length-1, true);
              // Dragging the entire frame.
              if (!self._draggingFrameTab) {
                var rect = self._ghost.rect();
                if (!rect.tabOrientation) {
                  rect.tabOrientation = self._draggingFrame.tabOrientation();
                }
                while (self._draggingFrame.panel()) {
                  self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.STACKED, panel, rect);
                }
              } else {
                var frame = panel._parent;
                if (frame instanceof wcFrame) {
                  index = index + frame._panelList.length;
                }
              }

              var frame = panel._parent;
              if (frame instanceof wcFrame) {
                frame.panel(index);
              }
              self.__focus(frame);
            }
          }
        } else if (self._creatingPanel) {
          var loc = wcDocker.DOCK.FLOAT;
          var target = null;
          if (anchor) {
            loc = anchor.loc;
            target = anchor.panel;
          }
          self.addPanel(self._creatingPanel, loc, target, self._ghost.rect());
        }

        self._ghost.destroy();
        self._ghost = null;

        self.trigger(wcDocker.EVENT.END_DOCK);
        self.__update();
      }

      if (self._draggingSplitter) { 
        self._draggingSplitter.$pane[0].removeClass('wcResizing');
        self._draggingSplitter.$pane[1].removeClass('wcResizing');
      }

      self._draggingSplitter = null;
      self._draggingFrame = null;
      self._draggingFrameSizer = null;
      self._draggingFrameTab = null;
      self._draggingFrameTopper = false;
      self._draggingCustomTabFrame = null;
      self._removingPanel = null;
      return true;
    };

    // on mousemove
    var lastMouseMove = new Date().getTime();
    var lastMouseEvent = null;
    var moveTimeout = 0;
    function __onMouseMove(event) {
      lastMouseEvent = event;
      var mouse = self.__mouse(event);
      if (mouse.which === 3 || (
        !self._draggingSplitter &&
        !self._draggingFrameSizer &&
        !self._draggingCustomTabFrame &&
        !self._ghost &&
        !self._draggingFrame &&
        !self._draggingFrameTab)) {
        return true;
      }

      var t = new Date().getTime();
      if (t - lastMouseMove < self._options.responseRate) {
        if (!moveTimeout) {
          moveTimeout = setTimeout(function() {
            lastMouseMove = 0;
            moveTimeout = 0;
            __onMouseMove(lastMouseEvent);
          }, self._options.responseRate);
        }
        return true;
      }

      lastMouseMove = new Date().getTime();

      if (self._draggingSplitter) {
        self._draggingSplitter.__moveBar(mouse);
      } else if (self._draggingFrameSizer) {
        var offset = self.$container.offset();
        mouse.x += offset.left;
        mouse.y += offset.top;

        self._draggingFrame.__resize(self._draggingFrameSizer, mouse);
        self._draggingFrame.__update();
      } else if (self._draggingCustomTabFrame) {
        var $hoverTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parents('.wcPanelTab');
        if (self._draggingFrameTab && $hoverTab && $hoverTab.length && self._draggingFrameTab !== event.target) {
          self._draggingFrameTab = self._draggingCustomTabFrame.moveTab(parseInt($(self._draggingFrameTab).attr('id')), parseInt($hoverTab.attr('id')));
        }
      } else if (self._ghost) {
        if (self._draggingFrame) {
          self._ghost.__move(mouse);
          var forceFloat = !(self._draggingFrame._isFloating || mouse.which === 1);
          var found = false;

          // Check anchoring with self.
          if (!self._draggingFrame.__checkAnchorDrop(mouse, true, self._ghost, self._draggingFrame._panelList.length > 1 && self._draggingFrameTab, self._draggingFrameTopper)) {
            self._draggingFrame.__shadow(true);
            self.__focus();
            if (!forceFloat) {
              for (var i = 0; i < self._frameList.length; ++i) {
                if (self._frameList[i] !== self._draggingFrame) {
                  if (self._frameList[i].__checkAnchorDrop(mouse, false, self._ghost, true, self._draggingFrameTopper)) {
                    self._draggingFrame.__shadow(true);
                    return;
                  }
                }
              }
            }

            self._ghost.anchor(mouse, null);
          } else {
            self._draggingFrame.__shadow(false);
            var $target = $(document.elementFromPoint(mouse.x, mouse.y));
            var $hoverTab = $target.hasClass('wcPanelTab')? $target: $target.parents('.wcPanelTab');
            if (self._draggingFrameTab && $hoverTab.length && self._draggingFrameTab !== $hoverTab[0]) {
              self._draggingFrameTab = self._draggingFrame.__tabMove(parseInt($(self._draggingFrameTab).attr('id')), parseInt($hoverTab.attr('id')));
            }
          }
        } else if (self._creatingPanel) {
          self._ghost.update(mouse);
        }
      } else if (self._draggingFrame && !self._draggingFrameTab) {
        self._draggingFrame.__move(mouse);
        self._draggingFrame.__update();
      }
      return true;
    };

    // on contextmenu for a, img
    function __onContextShowNormal() {
      if (this._contextTimer) {
        clearTimeout(this._contextTimer);
      }

      $(".wcFrame").contextMenu(false);
      this._contextTimer = setTimeout(function() {
        $(".wcFrame").contextMenu(true);
        this._contextTimer = null;
      }, 100);
      return true;
    };

    // on contextmenu for .wcSplitterBar
    function __onContextDisable() {
      return false;
    };

    // on mouseenter for .wcMenuCreatePanel
    function __onEnterCreatePanel() {
      if (self._ghost) {
        self._ghost.$ghost.stop().fadeIn(200);
      }
    };

    // on mouseleave for .wcMenuCreatePanel
    function __onLeaveCreatePanel() {
      if (self._ghost) {
        self._ghost.$ghost.stop().fadeOut(200);
      }
    };

    // on mousedown for .wcModalBlocker
    function __onMouseDownModalBlocker(event) {
      // for (var i = 0; i < self._modalList.length; ++i) {
      //   self._modalList[i].__focus(true);
      // }
      if (self._modalList.length) {
        self._modalList[self._modalList.length-1].__focus(true);
      }
    };

    // on mousedown for .wcPanelTab
    function __onPreventDefault(event) {
      event.preventDefault();
      event.returnValue = false;
    };

    // on mousedown for .wcFrameButtonBar > .wcFrameButton
    function __onMouseSelectionBlocker() {
      self.$container.addClass('wcDisableSelection');
    };

    // on click for .wcCustomTab .wcFrameButton
    function __onClickCustomTabButton(event) {
      self.$container.removeClass('wcDisableSelection');
      for (var i = 0; i < self._tabList.length; ++i) {
        var customTab = self._tabList[i];
        if (customTab.$close[0] === this) {
          var tabIndex = customTab.tab();
          customTab.removeTab(tabIndex);
          event.stopPropagation();
          return;
        }

        if (customTab.$tabLeft[0] === this) {
          customTab._tabScrollPos-=customTab.$tabBar.width()/2;
          if (customTab._tabScrollPos < 0) {
            customTab._tabScrollPos = 0;
          }
          customTab.__updateTabs();
          event.stopPropagation();
          return;
        }
        if (customTab.$tabRight[0] === this) {
          customTab._tabScrollPos+=customTab.$tabBar.width()/2;
          customTab.__updateTabs();
          event.stopPropagation();
          return;
        }
      }
    };

    // on click for .wcFrameButtonBar > .wcFrameButton
    function __onClickPanelButton() {
      self.$container.removeClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$close[0] === this) {
          var panel = frame.panel();
          self.removePanel(panel);
          self.__update();
          return;
        }
        if (frame.$collapse[0] === this) {
          var $icon = frame.$collapse.children('div');
          var position = wcDocker.DOCK.BOTTOM;
          if ($icon.hasClass('wcCollapseLeft')) {
            position = wcDocker.DOCK.LEFT;
          } else if ($icon.hasClass('wcCollapseRight')) {
            position = wcDocker.DOCK.RIGHT;
          }
          if (frame.isCollapser()) {
            // Un-collapse
            // var target;
            var opts = {};
            switch (position) {
              case wcDocker.DOCK.LEFT:
                // target = frame._parent._parent.right();
                opts.w = frame.$frame.width();
                break;
              case wcDocker.DOCK.RIGHT:
                // target = frame._parent._parent.left();
                opts.w = frame.$frame.width();
                break;
              case wcDocker.DOCK.BOTTOM:
                // target = frame._parent._parent.top();
                opts.h = frame.$frame.height();
                break;
            }
            var target = self._collapser[wcDocker.DOCK.LEFT]._parent.right();
            frame.collapse(true);
            self.movePanel(frame.panel(), position, target, opts);
          } else {
            // collapse.
            self.movePanel(frame.panel(), position, wcDocker.COLLAPSED);
          }
          self.__update();
          return;
        }
        if (frame.$tabLeft[0] === this) {
          frame._tabScrollPos-=frame.$tabBar.width()/2;
          if (frame._tabScrollPos < 0) {
            frame._tabScrollPos = 0;
          }
          frame.__updateTabs();
          return;
        }
        if (frame.$tabRight[0] === this) {
          frame._tabScrollPos+=frame.$tabBar.width()/2;
          frame.__updateTabs();
          return;
        }

        for (var a = 0; a < frame._buttonList.length; ++a) {
          if (frame._buttonList[a][0] === this) {
            var $button = frame._buttonList[a];
            var result = {
              name: $button.data('name'),
              isToggled: false,
            }

            if ($button.hasClass('wcFrameButtonToggler')) {
              $button.toggleClass('wcFrameButtonToggled');
              if ($button.hasClass('wcFrameButtonToggled')) {
                result.isToggled = true;
              }
            }

            var panel = frame.panel();
            panel.buttonState(result.name, result.isToggled);
            panel.__trigger(wcDocker.EVENT.BUTTON, result);
            return;
          }
        }
      }
    };

    // on mouseup for .wcPanelTab
    function __onReleasePanelTab(event) {
      var mouse = self.__mouse(event);
      if (mouse.which !== 2) {
        return;
      }

      var index = parseInt($(this).attr('id'));

      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$tabBar[0] === $(this).parents('.wcFrameTitleBar')[0]) {
          var panel = frame._panelList[index];
          if (self._removingPanel === panel) {
            self.removePanel(panel);
            self.__update();
          }
          return;
        }
      }
    };

    // on mousedown for .wcSplitterBar
    function __onMouseDownSplitter(event) {
      var mouse = self.__mouse(event);
      if (mouse.which !== 1) {
        return true;
      }

      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._splitterList.length; ++i) {
        if (self._splitterList[i].$bar[0] === this) {
          self._draggingSplitter = self._splitterList[i];
          self._draggingSplitter.$pane[0].addClass('wcResizing');
          self._draggingSplitter.$pane[1].addClass('wcResizing');
          event.preventDefault();
          break;
        }
      }
      return true;
    };

    // on mousedown for .wcFrameTitleBar
    function __onMouseDownFrameTitle(event) {
      var mouse = self.__mouse(event);
      if (mouse.which === 3) {
        return true;
      }
      // Skip frame buttons, they are handled elsewhere (Buttons may also have a child image or span so we check parent as well);
      if ($(event.target).hasClass('wcFrameButton') || $(event.target).parents('.wcFrameButton').length) {
        return true;
      }
      
      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i].$titleBar[0] == this ||
            self._frameList[i].$tabBar[0] == this) {
          self._draggingFrame = self._frameList[i];

          self._draggingFrame.__anchorMove(mouse);

          var $panelTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parents('.wcPanelTab');
          if ($panelTab && $panelTab.length) {
            var index = parseInt($panelTab.attr('id'));
            self._draggingFrame.panel(index, true);
            self._draggingFrameTab = $panelTab[0];
            $(window).focus();
          }

          // If the window is able to be docked, give it a dark shadow tint and begin the movement process
          var shouldMove = true;
          if (self._draggingFrameTab) {
            if ($panelTab.hasClass('wcNotMoveable')) {
              shouldMove = false;
            }
          } else {
            if (self._draggingFrame._isFloating && mouse.which === 1) {
              shouldMove = false;
            }
          }

          // if (((!$panelTab.hasClass('wcNotMoveable') && self._draggingFrameTab) ||
          //     !(self._draggingFrame.$titleBar.hasClass('wcNotMoveable') || self._draggingFrame.$tabBar.hasClass('wcNotMoveable'))) &&
          //     (!self._draggingFrame._isFloating || mouse.which !== 1 || self._draggingFrameTab)) {
          if (shouldMove) {
            // Special case to allow users to drag out only a single collapsed tab even by dragging the title bar (which normally would drag out the entire frame).
            if (!self._draggingFrameTab && self._draggingFrame.isCollapser()) {
              self._draggingFrameTab = self._draggingFrame.panel();
            }
            self._draggingFrameTopper = $(event.target).parents('.wcFrameTopper').length > 0;
            var rect = self._draggingFrame.__rect();
            self._ghost = new wcGhost(rect, mouse, self);
            self._draggingFrame.__checkAnchorDrop(mouse, true, self._ghost, true, self._draggingFrameTopper);
            self.trigger(wcDocker.EVENT.BEGIN_DOCK);
          }
          break;
        }
      }
      for (var i = 0; i < self._tabList.length; ++i) {
        if (self._tabList[i].$tabBar[0] == this) {
          self._draggingCustomTabFrame = self._tabList[i];

          var $panelTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parents('.wcPanelTab');
          if ($panelTab && $panelTab.length) {
            var index = parseInt($panelTab.attr('id'));
            self._draggingCustomTabFrame.tab(index, true);
            self._draggingFrameTab = $panelTab[0];
          }
          break;
        }
      }
      if (self._draggingFrame) {
        self.__focus(self._draggingFrame);
      }
      return true;
    };

    // on mousedown for .wcLayout
    function __onMouseDownLayout(event) {
      var mouse = self.__mouse(event);
      if (mouse.which === 3) {
        return true;
      }
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i].panel() && self._frameList[i].panel().layout().$table[0] == this) {
          setTimeout(function() {
            self.__focus(self._frameList[i]);
          }, 10);
          break;
        }
      }
      return true;
    };

    // on mousedown for .wcFrameEdge
    function __onMouseDownResizeFrame(event) {
      var mouse = self.__mouse(event);
      if (mouse.which === 3) {
        return true;
      }
      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i]._isFloating) {
          if (self._frameList[i].$top[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top'];
            break;
          } else if (self._frameList[i].$bottom[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom'];
            break;
          } else if (self._frameList[i].$left[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['left'];
            break;
          } else if (self._frameList[i].$right[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['right'];
            break;
          } else if (self._frameList[i].$corner1[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top', 'left'];
            break;
          } else if (self._frameList[i].$corner2[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top', 'right'];
            break;
          } else if (self._frameList[i].$corner3[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom', 'right'];
            break;
          } else if (self._frameList[i].$corner4[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom', 'left'];
            break;
          }
        }
      }
      if (self._draggingFrame) {
        self.__focus(self._draggingFrame);
      }
      return true;
    };

    // on mousedown for .wcCreatePanel
    function __onMouseDownCreatePanel(event) {
      var mouse = self.__mouse(event);
      if (mouse.which !== 1) {
        return true;
      }

      var panelType = $(this).data('panel');
      var info = self.panelTypeInfo(panelType);
      if (info) {
        var rect = {
          x: mouse.x-250,
          y: mouse.y,
          w: 500,
          h: 500,
        };
        self.$container.addClass('wcDisableSelection');
        self._ghost = new wcGhost(rect, mouse, self);
        self._ghost.update(mouse);
        self._ghost.anchor(mouse, self._ghost.anchor());
        self._creatingPanel = panelType;
        self.__focus();
        self.trigger(wcDocker.EVENT.BEGIN_DOCK);
      }
    }

    // on mousedown for .wcPanelTab
    function __onMouseDownPanelTab(event) {
      var mouse = self.__mouse(event);
      if (mouse.which !== 2) {
        return true;
      }

      var index = parseInt($(this).attr('id'));

      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$tabBar[0] === $(this).parents('.wcFrameTitleBar')[0]) {
          var panel = frame._panelList[index];
          self._removingPanel = panel;
          return true;
        }
      }
      return true;
    };

    // on keyup
    function __onKeyup(event) {
      if (event.keyCode == 27) {
        if (self._ghost) {
          self._ghost.destroy();
          self._ghost = false;
          self.trigger(wcDocker.EVENT.END_DOCK);

          if (self._draggingFrame) {
            self._draggingFrame.__shadow(false);
          }
          self._creatingPanel = false;
          self._draggingSplitter = null;
          self._draggingFrame = null;
          self._draggingFrameSizer = null;
          self._draggingFrameTab = null;
          self._draggingFrameTopper = false;
          self._draggingCustomTabFrame = null;
          self._removingPanel = null;
        }
      }
    };
  },

  // Test for browser compatability issues.
  __compatibilityCheck: function() {
    // Provide backward compatibility for IE8 and other such older browsers.
    if (!Function.prototype.bind) {
      Function.prototype.bind = function (oThis) {
        if (typeof this !== "function") {
          // closest thing possible to the ECMAScript 5
          // internal IsCallable function
          throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var aArgs = Array.prototype.slice.call(arguments, 1), 
            fToBind = this, 
            fNOP = function () {},
            fBound = function () {
              return fToBind.apply(this instanceof fNOP && oThis
                     ? this
                     : oThis,
                     aArgs.concat(Array.prototype.slice.call(arguments)));
            };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
      };
    }

    if (!Array.prototype.indexOf)
    {
      Array.prototype.indexOf = function(elt /*, from*/)
      {
        var len = this.length >>> 0;

        var from = Number(arguments[1]) || 0;
        from = (from < 0)
             ? Math.ceil(from)
             : Math.floor(from);
        if (from < 0)
          from += len;

        for (; from < len; from++)
        {
          if (from in this &&
              this[from] === elt)
            return from;
        }
        return -1;
      };
    }

    // Check if the browser supports transformations. If not, we cannot rotate tabs or collapse panels.
    var ie = (function(){
        var v = 3;
        var div = document.createElement('div');
        var all = div.getElementsByTagName('i');
        while (
            div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
            all[0]
        );
        return v > 4 ? v : undefined;
    }());

    if (ie < 9) {
      this._canOrientTabs = false;
    } else {
      function getSupportedTransform() {
        var prefixes = 'transform WebkitTransform MozTransform OTransform msTransform'.split(' ');
        var div = document.createElement('div');
        for(var i = 0; i < prefixes.length; i++) {
          if(div && div.style[prefixes[i]] !== undefined) {
            return true;
          }
        }
        return false;
      };
      this._canOrientTabs = getSupportedTransform();
    }

    // Check if we are running on a mobile device so we can alter themes accordingly.
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    $('body').addClass(isMobile? "wcMobile": "wcDesktop");
  },

  /*
   * Sets up the collapsers for the panel.<br>
   * <b>Note: </b> This should be called AFTER you have initialized your panel layout, but BEFORE you add
   * any static panels that you do not wish to be overlapped by the collapsers (such as file menu panels).
   */
  __initCollapsers: function() {
    // Initialize collapsers if it is enabled and not already initialized.
    if (!this.isCollapseEnabled() || !$.isEmptyObject(this._collapser)) {
      return;
    }

    function isPaneStatic(pane) {
      if (pane && pane instanceof wcFrame && pane.panel() && !pane.panel().moveable()) {
        return true;
      }
      return false;
    };

    var parent = this._root;
    while (parent) {
      if (parent instanceof wcSplitter) {
        var pane0 = isPaneStatic(parent._pane[0]);
        var pane1 = isPaneStatic(parent._pane[1]);
        if (pane0 && !pane1) {
          parent = parent._pane[1];
        } else if (pane1 && !pane0) {
          parent = parent._pane[0];
        } else if (!pane0 && !pane1) {
          break;
        }
      } else {
        break;
      }
    }

    function __createCollapser(location) {
      this._collapser[location] = this.__addCollapser(location, parent);
      parent = this._collapser[location]._parent;
      this._frameList.push(this._collapser[location]._drawer._frame);
    }

    __createCollapser.call(this, wcDocker.DOCK.LEFT);
    __createCollapser.call(this, wcDocker.DOCK.RIGHT);
    __createCollapser.call(this, wcDocker.DOCK.BOTTOM);

    var self = this;
    setTimeout(function() {
      self.__update();
    });
  },

  // Updates the sizing of all panels inside this window.
  __update: function(opt_dontMove) {
    this._dirty = true;
  },

  // Forces an update, regardless of the response rate.
  __forceUpdate: function(opt_dontMove) {
    this._dirty = false;
    if (this._root) {
      this._root.__update(opt_dontMove);
    }

    for (var i = 0; i < this._floatingList.length; ++i) {
      this._floatingList[i].__update();
    }
  },

  // Retrieve mouse or touch position.
  __mouse: function(event) {
    if (event.originalEvent && (event.originalEvent.touches || event.originalEvent.changedTouches)) {
      var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
      return {
        x: touch.clientX,
        y: touch.clientY,
        which: 1,
      };
    }

    return {
      x: event.clientX || event.pageX,
      y: event.clientY || event.pageY,
      which: event.which || 1,
    };
  },

  // On window resized event.
  __resize: function(event) {
    this._resizeData.time = new Date();
    if (!this._resizeData.timeout) {
      this._resizeData.timeout = true;
      setTimeout(this.__resizeEnd.bind(this), this._resizeData.delta);
      this.__trigger(wcDocker.EVENT.RESIZE_STARTED);
    }
    this.__trigger(wcDocker.EVENT.RESIZED);
    this.__update(false);
  },

  // On window resize event ended.
  __resizeEnd: function() {
    if (new Date() - this._resizeData.time < this._resizeData.delta) {
      setTimeout(this.__resizeEnd.bind(this), this._resizeData.delta);
    } else {
      this._resizeData.timeout = false;
      this.__trigger(wcDocker.EVENT.RESIZE_ENDED);
    }
  },

  // Brings a floating window to the top.
  // Params:
  //    frame     The frame to focus.
  //    flash     Whether to flash the frame.
  __focus: function(frame, flash) {
    var differentFrames = this._focusFrame != frame;
    if (this._focusFrame) {
      if (this._focusFrame._isFloating) {
        this._focusFrame.$frame.removeClass('wcFloatingFocus');
      }

      this._focusFrame.__trigger(wcDocker.EVENT.LOST_FOCUS);
      if (this._focusFrame.isCollapser() && differentFrames) {
        this._focusFrame.collapse();
        this._focusFrame.panel(-1);
      }
      this._focusFrame = null;
    }

    this._focusFrame = frame;
    if (this._focusFrame) {
      if (this._focusFrame._isFloating) {
        this._focusFrame.$frame.addClass('wcFloatingFocus');

        if (differentFrames) {
          $('body').append(this._focusFrame.$frame);
        }
      }
      this._focusFrame.__focus(flash);

      this._focusFrame.__trigger(wcDocker.EVENT.GAIN_FOCUS);
    }
  },

  // Triggers an event exclusively on the docker and none of its panels.
  // Params:
  //    eventName   The name of the event.
  //    data        A custom data parameter to pass to all handlers.
  __trigger: function(eventName, data) {
    if (!eventName) {
      return;
    }

    if (this._events[eventName]) {
      for (var i = 0; i < this._events[eventName].length; ++i) {
        this._events[eventName][i].call(this, data);
      }
    }
  },

  // Checks a given panel to see if it is the final remaining
  // moveable panel in the docker.
  // Params:
  //    panel     The panel.
  // Returns:
  //    true      The panel is the last.
  //    false     The panel is not the last.
  __isLastPanel: function(panel) {
    for (var i = 0; i < this._frameList.length; ++i) {
      var testFrame = this._frameList[i];
      if (testFrame._isFloating || testFrame.isCollapser()) {
        continue;
      }
      for (var a = 0; a < testFrame._panelList.length; ++a) {
        var testPanel = testFrame._panelList[a];
        if (testPanel !== panel && testPanel.moveable()) {
          return false;
        }
      }
    }

    return true;
  },

  // Checks a given frame to see if it is the final remaining
  // moveable frame in the docker.
  // Params:
  //    frame     The frame.
  // Returns:
  //    true      The panel is the last.
  //    false     The panel is not the last.
  __isLastFrame: function(frame) {
    for (var i = 0; i < this._frameList.length; ++i) {
      var testFrame = this._frameList[i];
      if (testFrame._isFloating || testFrame === frame || testFrame.isCollapser()) {
        continue;
      }
      for (var a = 0; a < testFrame._panelList.length; ++a) {
        var testPanel = testFrame._panelList[a];
        if (testPanel.moveable()) {
          return false;
        }
      }
    }

    return true;
  },

  // For restore, creates the appropriate object type.
  __create: function(data, parent, $container) {
    switch (data.type) {
      case 'wcSplitter':
        var splitter = new wcSplitter($container, parent, data.horizontal);
        splitter.scrollable(0, false, false);
        splitter.scrollable(1, false, false);
        return splitter;

      case 'wcFrame':
        var frame = new wcFrame($container, parent, data.floating);
        this._frameList.push(frame);
        if (data.floating) {
          this._floatingList.push(frame);
        }
        return frame;

      case 'wcPanel':
        for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
          if (this._dockPanelTypeList[i].name === data.panelType) {
            var panel = new wcPanel(data.panelType, this._dockPanelTypeList[i].options);
            panel._parent = parent;
            panel.__container(this.$transition);
            var options = (this._dockPanelTypeList[i].options && this._dockPanelTypeList[i].options.options) || {};
            panel._panelObject = new this._dockPanelTypeList[i].options.onCreate(panel, options);
            panel.__container($container);
            break;
          }
        }
        return panel;
    }

    return null;
  },

  // Attempts to insert a given dock panel into an already existing frame.
  // If insertion is not possible for any reason, the panel will be
  // placed in its own frame instead.
  // Params:
  //    panel         The panel to insert.
  //    targetPanel   An optional panel to 'split', if not supplied the
  //                  new panel will split the center window.
  __addPanelGrouped: function(panel, targetPanel, options) {
    var frame = targetPanel;
    if (targetPanel instanceof wcPanel) {
      frame = targetPanel._parent;
    }

    if (frame instanceof wcFrame) {
      if (options && options.tabOrientation) {
        frame.tabOrientation(options.tabOrientation);
      }

      frame.addPanel(panel);
      return;
    }

    // If we did not manage to find a place for this panel, last resort is to put it in its own frame.
    this.__addPanelAlone(panel, wcDocker.DOCK.LEFT, targetPanel, options);
  },

  // Creates a new frame for the panel and then attaches it
  // to the window.
  // Params:
  //    panel         The panel to insert.
  //    location      The desired location for the panel.
  //    targetPanel   An optional panel to 'split', if not supplied the
  //                  new panel will split the center window.
  __addPanelAlone: function(panel, location, targetPanel, options) {
    if (options) {
      var width = this.$container.width();
      var height = this.$container.height();

      if (options.hasOwnProperty('x')) {
        options.x = this.__stringToPixel(options.x, width);
      }
      if (options.hasOwnProperty('y')) {
        options.y = this.__stringToPixel(options.y, height);
      }
      if (!options.hasOwnProperty('w')) {
        options.w = panel.initSize().x;
      }
      if (!options.hasOwnProperty('h')) {
        options.h = panel.initSize().y;
      }
      options.w = this.__stringToPixel(options.w, width);
      options.h = this.__stringToPixel(options.h, height);

      panel._size.x = options.w;
      panel._size.y = options.h;
    }

    // If we are collapsing the panel, put it into the collapser.
    if (targetPanel === wcDocker.COLLAPSED) {
      this.__initCollapsers();
      if (this._collapser[location]) {
        targetPanel = this._collapser[location]._drawer._frame.addPanel(panel);
        var self = this;
        setTimeout(function() {self.__update();});
        return panel;
      } else {
        console.log('ERROR: Attempted to collapse panel "' + panel._type + '" to invalid location: ' + location);
        return false;
      }
    }

    // Floating windows need no placement.
    if (location === wcDocker.DOCK.FLOAT || location === wcDocker.DOCK.MODAL) {
      var frame = new wcFrame(this.$container, this, true);
      if (options && options.tabOrientation) {
        frame.tabOrientation(options.tabOrientation);
      }
      this._frameList.push(frame);
      this._floatingList.push(frame);
      this.__focus(frame);
      frame.addPanel(panel);
      frame.pos(panel._pos.x, panel._pos.y, false);

      if (location === wcDocker.DOCK.MODAL) {
        frame.$modalBlocker = $('<div class="wcModalBlocker"></div>');
        frame.$frame.prepend(frame.$modalBlocker);

        panel.moveable(false);
        frame.$frame.addClass('wcModal');
        this._modalList.push(frame);
      }

      if (options) {
        var pos = frame.pos(undefined, undefined, true);
        if (options.hasOwnProperty('x')) {
          pos.x = options.x + options.w/2;
        }
        if (options.hasOwnProperty('y')) {
          pos.y = options.y + options.h/2;
        }
        frame.pos(pos.x, pos.y, true);
        frame._size = {
          x: options.w,
          y: options.h,
        };
      }
      return;
    }

    if (targetPanel) {
      var parentSplitter = targetPanel._parent;
      var splitterChild = targetPanel;
      while (!(parentSplitter instanceof wcSplitter || parentSplitter instanceof wcDocker)) {
        splitterChild = parentSplitter;
        parentSplitter = parentSplitter._parent;
      }

      if (parentSplitter instanceof wcSplitter) {
        var splitter;
        var left  = parentSplitter.pane(0);
        var right = parentSplitter.pane(1);
        var size = {
          x: -1,
          y: -1,
        };
        if (left === splitterChild) {
          splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
          size.x = parentSplitter.$pane[0].width();
          size.y = parentSplitter.$pane[0].height();
          parentSplitter.pane(0, splitter);
        } else {
          splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
          size.x = parentSplitter.$pane[1].width();
          size.y = parentSplitter.$pane[1].height();
          parentSplitter.pane(1, splitter);
        }

        if (splitter) {
          splitter.scrollable(0, false, false);
          splitter.scrollable(1, false, false);

          if (!options) {
            options = {
              w: panel._size.x,
              h: panel._size.y,
            };
          }

          if (options) {
            if (options.w < 0) {
              options.w = size.x/2;
            }
            if (options.h < 0) {
              options.h = size.y/2;
            }

            switch (location) {
              case wcDocker.DOCK.LEFT:
                splitter.pos(options.w / size.x);
                break;
              case wcDocker.DOCK.RIGHT:
                splitter.pos(1.0 - (options.w / size.x));
                break;
              case wcDocker.DOCK.TOP:
                splitter.pos(options.h / size.y);
                break;
              case wcDocker.DOCK.BOTTOM:
                splitter.pos(1.0 - (options.h / size.y));
                break;
            }
          } else {
            splitter.pos(0.5);
          }

          frame = new wcFrame(this.$transition, splitter, false);
          this._frameList.push(frame);
          if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
            splitter.pane(0, frame);
            splitter.pane(1, splitterChild);
          } else {
            splitter.pane(0, splitterChild);
            splitter.pane(1, frame);
          }

          frame.addPanel(panel);
        }
        return;
      }
    }

    var parent = this;
    var $container = this.$container;
    var frame = new wcFrame(this.$transition, parent, false);
    this._frameList.push(frame);

    if (!parent._root) {
      parent._root = frame;
      frame.__container($container);
    } else {
      var splitter = new wcSplitter($container, parent, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
      if (splitter) {
        frame._parent = splitter;
        splitter.scrollable(0, false, false);
        splitter.scrollable(1, false, false);
        var size = {
          x: $container.width(),
          y: $container.height(),
        };

        if (!options) {
          splitter.__findBestPos();
        } else {
          if (options.w < 0) {
            options.w = size.x/2;
          }
          if (options.h < 0) {
            options.h = size.y/2;
          }

          switch (location) {
            case wcDocker.DOCK.LEFT:
              splitter.pos(options.w / size.x);
              break;
            case wcDocker.DOCK.RIGHT:
              splitter.pos(1.0 - (options.w / size.x));
              break;
            case wcDocker.DOCK.TOP:
              splitter.pos(options.h / size.y);
              break;
            case wcDocker.DOCK.BOTTOM:
              splitter.pos(1.0 - (options.h / size.y));
              break;
          }
        }

        if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
          splitter.pane(0, frame);
          splitter.pane(1, parent._root);
        } else {
          splitter.pane(0, parent._root);
          splitter.pane(1, frame);
        }

        parent._root = splitter;
      }
    }

    frame.addPanel(panel);
  },

  __addCollapser: function(location, parent) {
    var collapser = null;
    if (parent) {
      var parentSplitter = parent._parent;
      var splitterChild = parent;
      while (!(parentSplitter instanceof wcSplitter || parentSplitter instanceof wcDocker)) {
        splitterChild = parentSplitter;
        parentSplitter = parentSplitter._parent;
      }

      if (parentSplitter instanceof wcSplitter) {
        var splitter;
        var left  = parentSplitter.pane(0);
        var right = parentSplitter.pane(1);
        var size = {
          x: -1,
          y: -1,
        };
        if (left === splitterChild) {
          splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
          size.x = parentSplitter.$pane[0].width();
          size.y = parentSplitter.$pane[0].height();
          parentSplitter.pane(0, splitter);
        } else {
          splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
          size.x = parentSplitter.$pane[1].width();
          size.y = parentSplitter.$pane[1].height();
          parentSplitter.pane(1, splitter);
        }

        if (splitter) {
          splitter.scrollable(0, false, false);
          splitter.scrollable(1, false, false);
          collapser = new wcCollapser(this.$transition, splitter, location);

          switch (location) {
            case wcDocker.DOCK.TOP:
            case wcDocker.DOCK.LEFT:
              splitter.pos(0);
              break;
            case wcDocker.DOCK.BOTTOM:
            case wcDocker.DOCK.RIGHT:
              splitter.pos(1);
              break;
          }

          if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
            splitter.pane(0, collapser);
            splitter.pane(1, splitterChild);
          } else {
            splitter.pane(0, splitterChild);
            splitter.pane(1, collapser);
          }
        }
      }
    }
    return collapser;
  },

  // Adds the placeholder panel as needed
  __addPlaceholder: function(targetPanel) {
    if (this._placeholderPanel) {
      console.log('WARNING: wcDocker creating placeholder panel when one already exists');
    }
    this._placeholderPanel = new wcPanel(wcDocker.PANEL_PLACEHOLDER, {});
    this._placeholderPanel._isPlaceholder = true;
    this._placeholderPanel._parent = this;
    this._placeholderPanel.__container(this.$transition);
    this._placeholderPanel._panelObject = new function(myPanel) {
      myPanel.title(false);
      myPanel.closeable(false);
    }(this._placeholderPanel);

    if (targetPanel) {
      this.__addPanelGrouped(this._placeholderPanel, targetPanel);
    } else {
      this.__addPanelAlone(this._placeholderPanel, wcDocker.DOCK.TOP);
    }

    this.__update();
  },

  // Converts a potential string value to a percentage.
  __stringToPercent: function(value, size) {
    if (typeof value === 'string') {
      if (value.indexOf('%', value.length - 1) !== -1) {
        return parseFloat(value)/100;
      } else if (value.indexOf('px', value.length - 2) !== -1) {
        return parseFloat(value) / size;
      }
    }
    return parseFloat(value);
  },

  // Converts a potential string value to a pixel value.
  __stringToPixel: function(value, size) {
    if (typeof value === 'string') {
      if (value.indexOf('%', value.length - 1) !== -1) {
        return (parseFloat(value)/100) * size;
      } else if (value.indexOf('px', value.length - 2) !== -1) {
        return parseFloat(value);
      }
    }
    return parseFloat(value);
  },

};
