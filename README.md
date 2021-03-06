# ![Guide4You](images/g4u-logo.png) guide4you

[![Greenkeeper badge](https://badges.greenkeeper.io/KlausBenndorf/guide4you.svg)](https://greenkeeper.io/)

[![NPM](https://nodei.co/npm/guide4you.png?mini=true)](https://npmjs.org/package/guide4you)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![Continuous Integration](https://travis-ci.org/KlausBenndorf/guide4you.svg?branch=master)](https://travis-ci.org/KlausBenndorf/guide4you)

**GUIDE4YOU** is a JavaScript Web client application built on [OpenLayers](http://openlayers.org)
that supports both desktop and mobile web browsers and features a responsive design.

![Screenshot of desktop view, 736x467 pixel](images/screenshots/desktop-736-467.png "Screenshot of desktop view, 736x467 pixel")

For a screenshot of the mobile view [see below](#mobile-screenshot).

## What can GUIDE4YOU do for you?

With the basic system **GUIDE4YOU** can:

* Display maps like [Openstreetmap](https://openstreetmap.org), [OpenTopoMap](https://opentopomap.org), or [OpenCycleMap](http://www.thunderforest.com/maps/opencyclemap/)
* Use OSM, WMS, WFS, KML, GPX (others follow) 
* Measure areas and distances
* Display your location
* Print the current view on a single page
* Overlay a base map with points of interest and the like
* Configure a set of base maps and overlays to choose from
* Allow for different languages
* &hellip;

With additional modules it can also:

* [URLAPI module](https://github.com/KlausBenndorf/guide4you-module-urlapi): Generate links so you can share a certain view of a map. That view can include a location marker and a description of the location in question.
* [Search module](https://github.com/KlausBenndorf/guide4you-module-search): Search for locations using [Nominatim](https://nominatim.openstreetmap.org/). Alternatively you can customize this module to use other engines.
* Edit GPX data (coming soon)
* &hellip;

## Why use GUIDE4YOU?

Compared to alternative software **GUIDE4YOU** provides a couple of interesting features:

* Highly customizable
* Support for new languages can easily be added
* Icons are vector graphics (SVG) so they can be scaled to whatever size seems suitable
* No separate mobile and desktop versions
* Easily extensible

## Which browsers are supported?

All modern browsers including
* Firefox
* Chrome
* Edge and Internet Explorer 10+
* Safari

## How to install and build GUIDE4YOU?

Install guide4you from npm or clone the repository

```
npm install guide4you
```
or
```
git clone https://github.com/KlausBenndorf/guide4you.git
```

Then switch into the `guide4you` directory and install all dependecies using

```
npm install
```

Then build with a configuration of your choice

```
npm run build conf/simple
```

If you want to develop you can use the dev server script, which listens on port 8080 by default
 
```
npm run dev conf/simple
```

## <a name="mobile-screenshot"></a>Mobile Screenshot

![Screenshot of mobile view, 360x640 pixel](images/screenshots/mobile-360-640.png "Screenshot of mobile view, 360x640 pixel")
