pipeline {

  parameters {
    choice(name: 'ENVIRONMENT_DEPLOY', choices: getEnvironmentsList(BRANCH_NAME), description: 'Select deployment target environment')
    string(name: 'RELEASE_NUMBER', defaultValue: '', description: 'number used when creating a new relese e.g. 3.2.1')
    
  }

  environment {
    ACCOUNT_ID = getAccountId(ENVIRONMENT_DEPLOY)
  }

  options {
      // This is required if you want to clean before build
      skipDefaultCheckout(true)
      ansiColor('xterm')
      timestamps()
  }

  agent {
    kubernetes {
      defaultContainer 'terraspace'
      inheritFrom 'terraspace'
    }
  }
  
  stages {

    stage('Checkout') {
      steps {
       
        cleanWs()        
        checkout scm
      }
    }

    stage('Build Lambda SplunkForwarder') {
      steps {
        dir('src/lambda/splunk-forwarder') {
          sh '''
            npm ci
            npm run build
            npm run package
          '''
        }
      }
    }          

    stage('Run Unit Tests for SplunkForwarder') {
      steps {
        dir('src/lambda/splunk-forwarder') {
          sh '''            
            npm run test
            ls -la
          '''
        }
      }

      post {
        always {
          junit skipPublishingChecks: false, testResults: 'src/lambda/splunk-forwarder/junit.xml'

          clover(cloverReportDir: 'coverage', cloverReportFileName: 'clover.xml',
            // optional, default is: method=70, conditional=80, statement=80
            healthyTarget: [methodCoverage: 70, conditionalCoverage: 80, statementCoverage: 80],
            // optional, default is none
            unhealthyTarget: [methodCoverage: 50, conditionalCoverage: 50, statementCoverage: 50],
            // optional, default is none
            failingTarget: [methodCoverage: 0, conditionalCoverage: 0, statementCoverage: 0]
          )
        }
      }
    }

    stage('Build Lambda SubscriptionFilterHandler') {
      steps {
        dir('src/lambda/subscription-filter-handler') {
          sh '''
            npm ci
            npm run build
            npm run package
          '''
        }
      }
    }          

    stage('Run Unit Tests for SubscriptionFilterHandler') {
      steps {
        dir('src/lambda/subscription-filter-handler') {
          sh '''            
            npm run test
            ls -la
          '''
        }
      }

      post {
        always {
          junit skipPublishingChecks: false, testResults: 'src/lambda/subscription-filter-handler/junit.xml'

          clover(cloverReportDir: 'coverage', cloverReportFileName: 'clover.xml',
            // optional, default is: method=70, conditional=80, statement=80
            healthyTarget: [methodCoverage: 70, conditionalCoverage: 80, statementCoverage: 80],
            // optional, default is none
            unhealthyTarget: [methodCoverage: 50, conditionalCoverage: 50, statementCoverage: 50],
            // optional, default is none
            failingTarget: [methodCoverage: 0, conditionalCoverage: 0, statementCoverage: 0]
          )
        }
      }
    }

   stage('Deploy') {
      
      when {
       expression {
          params.ENVIRONMENT_DEPLOY != ""
        }
      }
      
      steps {
        script {
          sh '''
          	eval $(aws sts assume-role --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/app-iam-role-entint-default-ci-exec" --role-session-name "terraspace_provisioning" | jq -r '.Credentials | "export AWS_ACCESS_KEY_ID=\\(.AccessKeyId)\nexport AWS_SECRET_ACCESS_KEY=\\(.SecretAccessKey)\nexport AWS_SESSION_TOKEN=\\(.SessionToken)\n"')

            bundle config set --local path gems
            bundle install
            bundle update

            tags="{cir_app_id = \\"payld\\", cir_dataclass = \\"sensitive\\", Integration-Env = \\"${ENVIRONMENT_DEPLOY}\\", Integration-Version = \\"v1\\", Integration-Branch = \\"${BRANCH_NAME}\\", Integration-User = \\"${BUILD_USER}\\", Integration-Repository = \\"https://bitbucket.org/nsw-education/loggingservice-splunklogforwarder\\"}"

            export TS_VERSION_CHECK=0

            TS_ENV=${ENVIRONMENT_DEPLOY} bundle exec terraspace up logging_service  --auto-approve --verbose
          '''
        }
      }
    }
        
    stage('Create Release') {
      
      when {
        expression {
          params.ENVIRONMENT_DEPLOY == "test"
        }
      }
      
      steps {
        script {
          sh 'echo creating release'
        }
      }
    }
    
  }

  post {
    // Clean after build
    always {
      cleanWs(cleanWhenNotBuilt: false, deleteDirs: true, disableDeferredWipeout: true, notFailBuild: true, patterns: [[pattern: '.gitignore', type: 'INCLUDE']])
    }
  }

}

def getAccountId(environment) {
  
  if(environment.equals("test")) {
    return "959024001480"
  }

  if(environment.equals("preprod")) {
    return "294057591299"
  }

  if(environment.equals("prodsupport")) {
    return "294057591299"
  }

  if(environment.equals("prod")) {
    return "862534675796"
  }
  
  // Defaults to dev account
  return "318468042250"
}

def getEnvironmentsList(branchName) {

  if (branchName.equals("main") || branchName.startsWith("feature/")) {
    return ['', 'dev', 'test']
  } else if (branchName.startsWith("release/")) {
    return ['', 'preprod', 'prodsupport', 'prod']
  }

  return ['']
}