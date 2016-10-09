// Settings for jaxsnoop project
// 
// Execution context: nodejs

module.exports = {
    web_application_name: 'pyforum',
    
    previous_crawl_results: undefined,

    slimerjs_cli_settings: [
        // '--debug=page,pageloading,netprogress,config,cli,errors',
        // '-jsconsole',
        '--load-images=no',
        '--disk-cache=true'
    ],
    console_log_level: 'trace', // One of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'
    q_long_stack_support: true // Prameter from "q" library
};
