var path = require('path');

var exports = module.exports = function (fis) {

    fis.set('system.localNPMFolder', path.join(__dirname, 'node_modules'));

    // since fis3@3.3.21
    // 帮当前目录的查找提前在 global 查找的前面，同时又保证 local 的查找是优先的。
    if (fis.require.paths && fis.require.paths.length) {
        fis.require.paths.splice(1, 0, path.join(__dirname, 'node_modules'));
    }


    fis.require.prefixes.unshift('jello'); // 优先加载 jello 打头的插件。

    var weight = -100; // 此插件中，所有 match 默认的权重。
    var weightWithNs = -50; // 所有针对有 namespace 后设置的权重

    fis.set('namespace', '');
    fis.set('projName', '');
    fis.set('statics', '/static');
    fis.set('bearStatics', '/public');
    fis.set('templates', '/WEB-INF/views');

    // 默认捆绑 jello 的服务器。
    // fis3 server start 可以不指定 type.
    fis.set('server.type', 'jello');

    // 挂载 commonJs 模块化插件。
    //
    // 如果要使用 amd 方案，请先执行
    // fis.unhook('commonjs');
    // 然后再执行 fis.hook('amd');
    // 多个模块化方案插件不能共用。
    fis.hook('commonjs');

    fis

        // 对 less 文件默认支持。
        .match('*.less', {
            parser: fis.plugin('less'),
            rExt: '.css'
        }, weight)

        // 对 sass 文件默认支持。
        .match('*.{sass,scss}', {
            parser: fis.plugin('node-sass'),
            rExt: '.css',
            useSprite: true
        }, weight)

        // 对 tmpl 文件，默认采用 utc 插件转换成 js 函数。
        .match('*.tmpl', {
            parser: fis.plugin('utc'),
            rExt: '.js'
        }, weight)

        // 对vm文件，解析其中的parse，添加到依赖中
        .match('*.vm', {
            parser: fis.plugin('vmdeps'),
            rExt: '.vm'
        }, weight)

        // 对 vm 和 jsp 进行语言识别。
        .match('*.{vm,jsp}', {
            preprocessor: fis.plugin('extlang')
        }, weight)

    fis
        .match('*.{vm,js}', {
            useSameNameRequire: true
        })
        // 所有文件默认放 static 目录下面。
        // 后续会针对部分文件覆盖此配置。
        .match('**', {
            release: '${statics}/${namespace}/$0'
        }, weight)

        // 标记 components 、 page 和 widget 目录下面的 js 都是模块。
        .match('/{components,page,widget}/**.js', {
            isMod: true
        }, weight)

        // static 下面的文件直接发布到 $statics 目录。
        // 为了不多一层目录 static。
        .match('/static/(**)', {
            release: '${statics}/${namespace}/$1'
        }, weight)

        // test 目录原封不动发过去。
        .match('/test/(**)', {
            release: '/test/${namespace}/$1',
            isMod: false,
            useCompile: false
        }, weight)

        .match('/widget/**.{jsp,vm,html}', {
            url: '$0',
            release: '${templates}/${namespace}/$0',
            isMod: true
        }, weight)

        .match('/page/**.{jsp,vm,html}', {
            isMod: true,
            url: '$0',
            release: '${templates}/${namespace}/$0',
            extras: {
                isPage: true
            }
        }, weight)

        .match('{map.json,${namespace}-map.json}', {
            release: '/WEB-INF/config/$0'
        }, weight)

        // 注意这类文件在多个项目中都有的话，会被最后一次 release 的覆盖。
        .match('{fis.properties,server.conf}', {
            release: '/WEB-INF/$0'
        }, weight)

        .match('server.conf', {
            release: '/WEB-INF/server-${namespace}.conf'
        })

        .match('VM_global_library.vm', {
            release: '/${templates}/VM_global_library.vm'
        }, weight)

        // _ 下划线打头的都是不希望被产出的文件。
        .match('_*.{scss,tmpl,html}', {
            release: false
        }, weight)

        // assets下面不需要产出的文件。
        .match('/assets/**', {
            release: false
        }, weight)

        // 脚本也是。
        .match('**.{sh,bat}', {
            release: false
        }, weight);



    fis
        .media('pubvm')
        .match('/{components,widget}/**', {
            release: '/static/$0'
        }, weight)
        .match('{map.json,${namespace}-map.json}', {
            release: '$0'
        }, weight)
        .match('{*.md, package.json,component.json,server.conf, /test/**,/page/**}', {
            release: false
        }, weight)
        .match('/page/(layout/**)', {
            release: '/$1'
        }, weight)
        .match('/widget/**.{vm,html}', {
            release: '/static/$0'
        }, weight);


    // 当用户 fis-conf.js 加载后触发。
    fis.on('conf:loaded', function () {
        var compress = fis.get('_compress_');

        fis
            .media('dev')
             //conf and hbs not release in dev mode
            .match('**.{conf.json, hbs}', {
                release: false
            }, weight)

            .match('::package', {
                spriter: fis.plugin('csssprites-plus', {
                    margin: 10,
                    layout: 'matrix',
                    to: './img'
                }),
                postpackager: fis.plugin('bear', {
                    comb: fis.get('combSetting')
                })
            }, weight);


        fis
            .media('pubvm')
            .match('*', {
                deploy: [
                    fis.plugin('filter', { exclude: ['server*.conf'] }),
                    fis.plugin('local-deliver', {
                        to: fis.get('pubvmDir')
                    })
                ]
            })
            .match('::package', {
                spriter: fis.plugin('csssprites-plus', {
                    margin: 10,
                    layout: 'matrix',
                    to: './img'
                }),
                postpackager: fis.plugin('bear', {
                    pubType: 'pubvm',
                    comb: fis.get('combSetting')
                })
            }, weight + 1);

        if (compress) {
            fis
                .media('pubvm')
                .match('*.js', {
                    optimizer: fis.plugin('uglify-js')
                }, weight)

                .match('*.{scss, sass, less, css}', {
                    optimizer: fis.plugin('clean-css')
                }, weight)

                .match('*.png', {
                    optimizer: fis.plugin('png-compressor')
                }, weight);
            }

        fis
            .media('pubpage')
            .match('::package', {
                spriter: fis.plugin('csssprites-plus', {
                    margin: 10,
                    layout: 'matrix',
                    to: './img'
                }),
                postpackager: fis.plugin('bear', {
                    pubType: 'pubpage',
                    comb: fis.get('combSetting')
                })
            }, weight + 1);



        if (!fis.get('namespace')) return;

        fis.match('/{page,widget}/**.{jsp,vm,html}', {
            url: '/${namespace}$0'
        }, weightWithNs);
    });
};

exports.init = exports;
