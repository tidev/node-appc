# i18n Tool

This i18n tool makes it easy to analyze projects for i18n information and to sync that data with
webtranslateit.com.

## Usage

    forge i18n <action> [options]

## Configuration

This tool is configured via a config file located at `<home-directory>/.titanium/i18n-sync.json`.
The file contains Appcelerator's webtranslateit.com private key and a list of projects locations.

Copy the `i18n-sync.example.json` file to `<home-directory>/.titanium/i18n-sync.json`, then
edit the file and specify the private key and the correct local path for each project.

## Actions

### analyze

    forge i18n analyze [--write]

This will scan all projects listed in the config file for all __(), __n(), and __f() function
calls. If `--write` is specified, then the strings passed into the i18n functions are updated
into each project's `<project-location>/locales/en.js` file.

### prepare

    forge i18n prepare [--write]

This will scan all projects listed in the config file for all __(), __n(), and __f() function
calls, then assemble all strings into a single master locale file that can be manually uploaded
to the "Titanium CLI" webtranslateit.com project. This performs an `analyze` action prior to
assembling the master locale file.

### pull

    forge i18n pull [--write]

Downloads the i18n strings from the "Titanium CLI" webtranslateit.com project and updates each
project's i18n string files defined in the project's `<project-location>/locales/` directory.
