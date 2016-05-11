// Settings for each crawler instance

module.exports = {
    url_start: 'http://127.0.0.1:8000/pyforum/default/index',
    url_whitelist: ['http://127.0.0.1:8000/pyforum/.*'],
    url_blacklist: [],

    users: {
        public: {
            login_function: function () {},
            logout_function: function () {}
        },
        member_1: {
            login_function: function () {},
            logout_function: function () {}
        }
    },

    logLevel: 'info'
};
