// Settings for jaxsnoop project

module.exports = {
    web_application_name: 'pyforum',
    
    previous_crawl_results: undefined,

    slimerjs_cli_settings: [
        // '--debug=page,pageloading,netprogress,config,cli,errors',
        // '-jsconsole',
        '--load-images=false',
        '--disk-cache=true'
    ],
    console_log_level: 'debug', /* debug -> info -> warn -> error */
    q_long_stack_support: true
};
