import ol from 'openlayers'
import $ from 'jquery'
import flatten from 'lodash/flatten'

import {ListenerOrganizerMixin} from './ListenerOrganizerMixin'
import {Window} from './html/Window'
import {cssClasses} from './globals'
import { finishAllImages, mixin } from './utilities'
import {Debug} from './Debug'

import '../less/featurepopup.less'

/**
 * @typedef {object} FeaturePopupOptions
 * @property {string} [className='g4u-featurepopup']
 * @property {number[]} [offset=[0,0]]
 * @property {ol.OverlayPositioning} [positioning='center-center']
 * @property {number[]} [iconSizedOffset=[0,0]]
 * @property {boolean} [centerOnPopup=false]
 * @property {boolean} [animated=true]
 * @property {string[]} [mutators] default mutators to use
 */

/**
 * @typedef {function} Mutator
 * @param {string} text
 * @returns {string}
 */

/**
 * Displays a Popup bound to a geographical position via an ol.Overlay
 */
export class FeaturePopup extends mixin(ol.Object, ListenerOrganizerMixin) {
  /**
   * @param {FeaturePopupOptions} options
   */
  constructor (options = {}) {
    super()

    /**
     * @type {string}
     * @private
     */
    this.className_ = (options.hasOwnProperty('className')) ? options.className : 'g4u-featurepopup'

    /**
     * @type {string}
     * @private
     */
    this.classNameFeatureName_ = this.className_ + '-feature-name'

    /**
     * @type {string}
     * @private
     */
    this.classNameFeatureDescription_ = this.className_ + '-feature-description'

    /**
     * @type {jQuery}
     * @private
     */
    this.$name_ = $('<h3>').addClass(this.classNameFeatureName_)

    /**
     * @type {jQuery}
     * @private
     */
    this.$description_ = $('<p>').addClass(this.classNameFeatureDescription_)

    /**
     * @type {null|ol.Feature}
     * @private
     */
    this.feature_ = null

    /**
     * @type {boolean}
     * @private
     */
    this.visible_ = false

    /**
     * @type {VectorLayer[]}
     * @private
     */
    this.referencingVisibleLayers_ = []

    /**
     * @type {number[]}
     * @private
     */
    this.pixelOffset_ = options.hasOwnProperty('offset') ? options.offset : [ 0, 0 ]

    /**
     * @type {number[]}
     * @private
     */
    this.iconSizedOffset_ = options.hasOwnProperty('iconSizedOffset') ? options.iconSizedOffset : [ 0, 0 ]

    /**
     * @type {boolean}
     * @private
     */
    this.centerOnPopup_ = options.hasOwnProperty('centerOnPopup') ? options.centerOnPopup : true

    /**
     * @type {boolean}
     * @private
     */
    this.centerOnPopupInitial_ = this.centerOnPopup_

    /**
     * @type {boolean}
     * @private
     */
    this.animated_ = options.hasOwnProperty('animated') ? options.animated : true

    /**
     * @type {jQuery}
     * @private
     */
    this.$element_ = $('<div>').addClass(this.className_).addClass(cssClasses.hidden)

    /**
     * @type {ol.Overlay}
     * @private
     */
    this.overlay_ = new ol.Overlay({
      element: this.$element_.get(0),
      offset: this.pixelOffset_,
      positioning: options.hasOwnProperty('positioning') ? options.positioning : 'center-center',
      stopEvent: false
    })

    /**
     * @type {Map.<string,function>}
     * @private
     */
    this.mutators_ = new Map()

    /**
     * @type {string[]}
     * @private
     */
    this.defaultMutators_ = options.mutators || []

    /**
     * @type {string[]}
     * @private
     */
    this.useMutators_ = []

    /**
     * @type {?Window}
     * @private
     */
    this.window_ = null

    /**
     * @type {?G4UMap}
     * @private
     */
    this.map__ = null
  }

  /**
   * @param {ol.Feature} feature
   * @returns {boolean}
   */
  static canDisplay (feature) {
    return !feature.get('disabled') && (feature.get('name') ||
      (feature.get('description') && $(feature.get('description')).text().match(/\S/)))
  }

  /**
   * @param {G4UMap} map
   */
  setMap (map) {
    if (this.getMap()) {
      this.detachAllListeners()
      this.getMap().removeOverlay(this.overlay_)
    }

    if (map) {
      this.window_ = new Window({ draggable: false, fixedPosition: true, map: map })

      this.window_.get$Body().append(this.$name_).append(this.$description_)

      this.listenAt(this.window_).on('change:visible', () => {
        if (!this.window_.getVisible()) {
          this.setVisible(false) // notifying the featurepopup about the closing of the window
        }
      })

      this.$element_.append(this.window_.get$Element())

      // feature click

      this.listenAt(map.getDefaultInteractions('singleclick')[ 0 ]).on('select', e => {
        let selected = e.selected.filter(FeaturePopup.canDisplay)
        if (selected.length) {
          this.onFeatureClick_(selected[ 0 ], e.mapBrowserEvent.coordinate)
          e.target.getFeatures().remove(selected[ 0 ]) // remove feature to be able to select feature again
          e.target.changed()
        }
      })

      // feature hover

      this.listenAt(map.getDefaultInteractions('pointermove')[ 0 ]).on('select', e => {
        let selected = e.selected.filter(FeaturePopup.canDisplay)
        let deselected = e.deselected.filter(FeaturePopup.canDisplay)
        if (selected.length) {
          $(map.getViewport()).addClass(cssClasses.clickable)
        } else if (deselected.length) {
          $(map.getViewport()).removeClass(cssClasses.clickable)
        }
      })

      // hiding feature Popup if the layer gets hidden or the feature gets removed

      let forEachSource = (layer, source) => {
        if (source.getFeatures) {
          this.listenAt(source).on('removefeature', e => {
            if (e.feature === this.getFeature()) {
              this.referencingVisibleLayers_.forEach(function (layer) {
                if (layer.getSource() === source) {
                  this.removeReferencingLayer_(layer)
                }
              })
            }
          })
        }
      }

      let forEachLayer = layer => {
        if (layer.getSource) {
          let source = layer.getSource()

          if (source) {
            forEachSource(layer, source)
          }

          this.listenAt(layer).on('change:source', e => {
            this.detachFrom(e.oldValue)
            forEachSource(layer, layer.getSource())
          })

          this.listenAt(layer).on('change:visible', () => {
            let source = layer.getSource()
            if (source && source.getFeatures) {
              if (layer.getVisible() === false) {
                if (source.getFeatures().indexOf(this.getFeature()) > -1) {
                  this.removeReferencingLayer_(layer)
                }
              } else {
                if (source.getFeatures().indexOf(this.getFeature()) > -1) {
                  this.referencingVisibleLayers_.push(layer)
                }
              }
            }
          })
        }

        if (layer.getLayers) {
          layer.getLayers().forEach(forEachLayer)
          this.listenAt(layer.getLayers())
            .on('add', e => {
              forEachLayer(e.element)
            })
            .on('remove', e => {
              if (e.element.getSource && e.element.getSource()) {
                this.detachFrom(e.element.getSource())
              }
              this.detachFrom(e.element)
            })
        }
      }

      forEachLayer(map.getLayerGroup())

      map.addOverlay(this.overlay_)

      this.$element_.parent().addClass(this.className_ + '-container')

      // disable scrolling of body and zooming into map while in the feature popup
      this.window_.get$Element().on('mousewheel wheel DOMMouseScroll', function (e) {
        e.stopPropagation()
        e.preventDefault()
      })

      let onMapChangeMobile = () => {
        if (map.get('mobile')) {
          this.centerOnPopup_ = false
        } else {
          this.centerOnPopup_ = this.centerOnPopupInitial_
        }
      }

      onMapChangeMobile()
      this.listenAt(map).on('change:mobile', onMapChangeMobile)

      // limiting size

      map.once('postrender', () => {
        this.window_.updateSize()
      })
    }

    this.map__ = map
  }

  /**
   * @param {ol.Feature} feature
   * @param {ol.Coordinate} coordinate
   * @private
   */
  onFeatureClick_ (feature, coordinate = null) {
    this.referencingVisibleLayers_ = []

    this.getMap().getLayerGroup().recursiveForEach(layer => {
      if (layer.getVisible() && layer.getSource && layer.getSource().getFeatures) {
        if (layer.getSource().getFeatures().indexOf(feature) > -1) {
          this.referencingVisibleLayers_.push(layer)
        }
      }
    })

    this.setFeature(feature, coordinate)
    this.setVisible(true)

    if (this.centerOnPopup_) {
      this.centerMapOnPopup()
    }
  }

  /**
   * @param {VectorLayer} layer
   * @private
   */
  removeReferencingLayer_ (layer) {
    this.referencingVisibleLayers_.splice(this.referencingVisibleLayers_.indexOf(layer), 1)
    if (this.referencingVisibleLayers_.length === 0) {
      this.setVisible(false)
    }
  }

  /**
   * @returns {G4UMap}
   */
  getMap () {
    return this.map__
  }

  /**
   * @returns {null|ol.Feature}
   */
  getFeature () {
    return this.feature_
  }

  /**
   * @returns {Array|VectorLayer[]}
   */
  getLayers () {
    return this.referencingVisibleLayers_
  }

  /**
   * register a text mutator with a name. Which mutator is finally used can be adjusted via the config files.
   * @param {string} name
   * @param {Mutator} mutator
   */
  registerMutator (name, mutator) {
    this.mutators_.set(name, mutator)
  }

  /**
   * Update the Popup. Call this if something in the feature has changed
   */
  update () {
    if (this.getFeature()) {
      const feature = this.getFeature()

      const updateContent = () => {
        if (this.getMap().get('localiser').isRtl()) {
          this.window_.get$Body().prop('dir', 'rtl')
        } else {
          this.window_.get$Body().prop('dir', undefined)
        }

        let name = feature.get('name')
        let description = feature.get('description')

        if (name) {
          this.$name_.html(name)
        }

        if (description) {
          for (let m of this.useMutators_) {
            let mutator = this.mutators_.get(m)
            if (mutator) {
              description = mutator(description)
            } else {
              Debug.error(`Trying to use unregistered mutator ${m}`)
            }
          }
          this.$description_.html(description)
        }

        this.updateSize()
      }

      this.$name_.empty()
      this.$description_.empty()

      updateContent() // this produces one unnecessary call to window.updateSize()

      if (!feature.get('observedByPopup')) {
        feature.on('change:name', updateContent)
        feature.on('change:description', updateContent)
        feature.set('observedByPopup', true)
      }

      this.once('change:feature', () => {
        feature.un('change:name', updateContent)
        feature.un('change:description', updateContent)
        feature.set('observedByPopup', false)
      })

      if (!this.getMap().get('mobile')) {
        let resolution = this.getMap().getView().getResolution()

        this.addIconSizedOffset(this.getFeature(), resolution)
      }

      if (this.referencingVisibleLayers_.length) {
        this.window_.get$Element().attr('data-layer-0', this.referencingVisibleLayers_[0].get('id'))
      }

      // apply default offset

      if (this.getVisible()) {
        setTimeout(() => this.window_.updateSize(), 0)
      }

      this.dispatchEvent('update:content')
    }
  }

  updateSize () {
    if (this.getVisible() && this.window_ && this.window_.updateSize) {
      this.window_.updateSize()
    }
  }

  /**
   * The feature should have a property 'name' and/or 'description' to be shown inside of the popup.
   * @param {ol.Feature} feature
   * @param {ol.Coordinate} coordinate
   * @param {string[]} [optMutators=[]]
   */
  setFeature (feature, coordinate = null, optMutators = []) {
    let oldValue = this.feature_
    if (feature) {
      this.overlay_.setPosition(coordinate || ol.extent.getCenter(feature.getGeometry().getExtent()))
    }

    if (oldValue !== feature) {
      if (this.feature_) {
        this.feature_.un('change:geometry', this.geometryChangeHandler_)
      }
      this.feature_ = feature
      this.useMutators_ = [ ...this.defaultMutators_, ...optMutators ]
      for (let layer of this.referencingVisibleLayers_) {
        this.useMutators_ = this.useMutators_.concat(flatten(layer.get('mutators')))
      }
      this.geometryChangeHandler_ = () => {
        this.overlay_.setPosition(coordinate || ol.extent.getCenter(this.feature_.getGeometry().getExtent()))
        if (this.getVisible()) {
          this.update()
        }
      }
      this.feature_.on('change:geometry', this.geometryChangeHandler_)
      this.dispatchEvent({
        type: 'change:feature',
        oldValue: oldValue,
        key: 'feature'
      })

      this.update()
    }
  }

  /**
   * @returns {boolean}
   */
  getVisible () {
    return this.visible_
  }

  /**
   * @param {boolean} visible
   */
  setVisible (visible) {
    let oldValue = this.visible_
    if (oldValue !== visible) {
      if (visible === true && this.getFeature()) {
        this.$element_.removeClass(cssClasses.hidden)
        this.window_.setVisible(true)
      } else {
        this.$element_.addClass(cssClasses.hidden)
        this.window_.setVisible(false)
      }

      this.visible_ = visible

      this.dispatchEvent({
        type: 'change:visible',
        oldValue: oldValue,
        key: 'visible'
      })
    }

    if (visible) {
      setTimeout(() => this.window_.updateSize(), 0)
    }
  }

  /**
   * calculates iconSized Offset and applies it
   * @param {ol.Feature} feature
   * @param {number} resolution
   */

  addIconSizedOffset (feature, resolution) {
    if (this.iconSizedOffset_[ 0 ] !== 0 || this.iconSizedOffset_[ 1 ] !== 0) {
      let featureStyleFunction = feature.getStyleFunction()
      if (featureStyleFunction) {
        let style = featureStyleFunction.call(feature, resolution)[ 0 ]
        if (style) {
          let imageStyle = style.getImage()
          if (imageStyle instanceof ol.style.Icon) {
            (new Promise(resolve => {
              let img = imageStyle.getImage()
              if (img.complete && img.src) {
                resolve()
              } else {
                img.addEventListener('load', () => {
                  this.getMap().render() // initiate styles with size and anchor
                  this.getMap().once('postcompose', resolve)
                })
                imageStyle.load()
              }
            })).then(() => {
              let iconSize = imageStyle.getSize()

              let totalOffset = [
                this.pixelOffset_[ 0 ] + this.iconSizedOffset_[ 0 ] * iconSize[ 0 ] * (imageStyle.getScale() || 1),
                this.pixelOffset_[ 1 ] + this.iconSizedOffset_[ 1 ] * iconSize[ 1 ] * (imageStyle.getScale() || 1)
              ]

              this.overlay_.setOffset(totalOffset)
            })
          }
        }
      }
    }
  }

  /**
   * Centers the map on the popup after all images have been loaded
   */
  centerMapOnPopup (animated) {
    animated = animated === undefined ? this.animated_ : animated

    const _centerMap = () => {
      this.window_.updateSize()
      this.getMap().get('move').toPoint(this.getCenter(), { animated })
    }

    finishAllImages(this.window_.get$Body()).then(() => {
      // we need to do this trick to find out if map is already visible/started rendering
      if (this.getMap().getPixelFromCoordinate([ 0, 0 ])) {
        _centerMap()
      } else {
        this.getMap().once('postrender', _centerMap)
      }
    })
  }

  /**
   * calculates Center of the Popup. Be careful, this calculation repositions the popup to calculate the center
   * properly and repostions to the initial Position again.
   * This does only work if the popup is already visible!
   * @returns {ol.Coordinate}
   */
  getCenter () {
    let offset = this.overlay_.getOffset()

    let pixelPosition = this.getMap().getPixelFromCoordinate(this.overlay_.getPosition())

    // apply offset
    pixelPosition[ 0 ] += offset[ 0 ]
    pixelPosition[ 1 ] += offset[ 1 ]

    // applay width/height depending on positioning
    let positioning = this.overlay_.getPositioning().split('-')

    let width = this.$element_.outerWidth()
    let height = this.$element_.outerHeight()

    if (positioning[ 1 ] === 'left') {
      pixelPosition[ 0 ] += width / 2
    }
    if (positioning[ 1 ] === 'right') {
      pixelPosition[ 0 ] -= width / 2
    }

    if (positioning[ 0 ] === 'top') {
      pixelPosition[ 1 ] += height / 2
    }
    if (positioning[ 0 ] === 'bottom') {
      pixelPosition[ 1 ] -= height / 2
    }

    return this.getMap().getCoordinateFromPixel(pixelPosition)
  }
}
