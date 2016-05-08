// Settings for jaxsnoop crawler

module.exports = {
    web_application_name: 'pyforum',
    q_long_stack_support: true,

    previous_crawl_results: undefined,

    url_start: 'http://127.0.0.1:8000/pyforum/default/index',
    url_whitelist: ['http://127.0.0.1:8000/pyforum/.*'],
    url_blacklist: [],

    users: {
        public: {
            login_function: () => {},
            logout_function: () => {}
        },
        member_1: {
            login_function: () => {},
            logout_function: () => {}
        }
    }
};
