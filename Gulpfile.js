var gulp = require('gulp')
var sourcemaps = require('gulp-sourcemaps')
var babel = require('gulp-babel')
var mocha = require('gulp-spawn-mocha')
var run = require('gulp-run')
var pathJoin = require('path').join

gulp.task('compile', function () {
    return gulp.src('src/*.js')
        .pipe(sourcemaps.init())
        .pipe(babel({
            optional: ['es7.asyncFunctions', 'runtime'],
        }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
})

gulp.task('showdown', function () {
    var path = pathJoin(process.cwd(), 'showdown')
    return run('npm install --production', {cwd: path}).exec()
})

gulp.task('test', ['compile', 'showdown'], function () {
    return gulp.src('dist/_test.js', {read: false})
        .pipe(mocha())
})

gulp.task('default', ['test'])

gulp.task('watch', ['test'], function () {
    gulp.watch('src/*.js', ['test'])
})
