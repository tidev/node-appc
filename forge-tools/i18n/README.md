# i18n Sync Tool

This i18n sync tool makes it easy to analyze projects for i18n information and to sync that data with
webtranslateit.com.

## Usage

    forge i18n [action]

## Configuration

This tool is configured via a config file located at ```<home-directory>/.titanium/i18n-sync.json```.
The file contains Appcelerator's webtranslateit.com private key and a list of projects locations.

Copy the ```i18n-sync.example.json``` file to ```<home-directory>/.titanium/i18n-sync.json```, then
edit the file and specify the private key and the correct local path for each project.

## Actions

### analyze

    forge i18n analyze

This will analyze all projects listed in the config file for information and generate an appropriate
locale file for each project in ```<project-location>/locales/en.js```. It is highly recommended that
you run this before running ```pull```.

### prepare

    forge i18n prepare

This will take each project's ```<project-location>/locales/en.js``` and assemble a single master
locale file that can be manually uploaded to the "Titanium CLI" webtranslateit.com project.

### pull

    forge i18n pull

Downloads the i18n strings from the "Titanium CLI" webtranslateit.com project and updates each
project's generate the appropriate locale files for each of the projects in the config in
```<project-location>/locales/``` directory.
