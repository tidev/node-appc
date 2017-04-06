library 'pipeline-library'

timestamps {
  node('(osx || linux) && git && npm-publish') {
    stage ('Checkout') {
      checkout scm
    } // stage

    def packageVersion = jsonParse(readFile('package.json'))['version']
    currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"

    def isPR = env.BRANCH_NAME.startsWith('PR-')
    def publish = !isPR
    def tagGit = !isPR
    def updateJIRA = !isPR

    nodejs(nodeJSInstallationName: 'node 6.9.5') {
      ansiColor('xterm') {
        stage('Security') {
          sh 'npm install --production'
          // Scan for NSP and RetireJS warnings
          sh 'npm install nsp'
          sh 'node_modules/nsp/bin/nsp check --output summary --warn-only'
          sh 'npm uninstall nsp'
          sh 'npm prune'

          sh 'npm install retire'
          sh 'node_modules/retire/bin/retire --exitwith 0'
          sh 'npm uninstall retire'
          sh 'npm prune'

          step([$class: 'WarningsPublisher', canComputeNew: false, canResolveRelativePaths: false, consoleParsers: [[parserName: 'Node Security Project Vulnerabilities'], [parserName: 'RetireJS']], defaultEncoding: '', excludePattern: '', healthy: '', includePattern: '', messagesPattern: '', unHealthy: ''])
        }

        // TODO Run npm-check-updates?
        // npm install npm-check-updates
        // ./node_modules/npm-check-updates/bin/ncu --packageFile ./package.json

        stage('Build') {
          sh 'npm install'
          sh 'npm run-script jenkins-test'
          junit 'junit_report.xml'
          fingerprint 'package.json'
        }

        stage('Publish') {
          if (tagGit) {
            pushGitTag(name: packageVersion, force: true, message: "See ${env.BUILD_URL} for more information.")
          }

          if (publish) {
            sh 'npm publish'
          }

          if (updateJIRA) {
            // Updates the issues by commenting on them...
            step([$class: 'hudson.plugins.jira.JiraIssueUpdater',
              issueSelector: [$class: 'hudson.plugins.jira.selector.DefaultIssueSelector'],
              scm: scm])
          } // end-if not PR
        }
      } // ansiColor
    } // nodejs
  } // node
} // timestamps
