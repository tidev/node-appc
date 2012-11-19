i18n Management and Synchronization tool
----------------------------------------

This tool makes it easy to analyze projects for i18n information and to sync that data with Web Translate It. The basic
command is
```
./i18n-sync.js [command]
```

# Configuring
The i18n synchronization tool is configured via a config file located at ```<home-directory>/.titanium/i18n-sync.json```.
The file contains a list of projects and their locations, along with the private key for the Web Translate It Titanium CLI
project. See the ```config.json``` file in the repo for an example of what this file looks like.

# Commands

### analyze
This command will analyze all projects listed in the config file for information and generate an appropriate locale file
for each project in ```<project-location>/locales/en.js```. It is highly recommended that you run this command before
running ```push``` or ```pull```

### push
This command will take each project's ```<project-location>/locales/en.js``` and assemble a single master locale file
from it. This file is then uploaded to the Titanium CLI Web Translate It project. Uploading is not currently implemented,
so the master file must be uploaded manually through the Web Translate it software interface.

### pull
This command will pull the locale information from Web Translate It and generate the appropriate locale files for each of
the projects in the config in ```<project-location>/locales/```.