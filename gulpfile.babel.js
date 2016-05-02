import gulp from 'gulp';
import eslint from 'gulp-eslint';
import babel from 'gulp-babel';
import sourcemaps from 'gulp-sourcemaps';
import sloc from 'gulp-sloc';
import bumpVersion from 'gulp-bump';
import runSequence from 'run-sequence';
import del from 'del';
import todo from 'gulp-todo';
import git from './gitStreamed';
import fs from 'fs';

/* ************************************************************************* */
/* Helpers                                                                   */
/* ************************************************************************* */

const getPackageJSON = () => JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const getBabelRC = () => JSON.parse(fs.readFileSync('./.babelrc', 'utf8'));

/*
* Generate and add todo task before committing.
*/
gulp.task('todo', () => gulp.src('src/**/*.js')
  .pipe(todo())
  .pipe(gulp.dest('./')));

/*
* CLean whatever directory is passed in.
*/
const clean = distGlob => (
  del([
    distGlob
  ])
);

/*
* Copy necessary files to the /dist folder for publishing after transpiling.
*/
const copy = (fileGlob, destDir) => gulp.src(fileGlob)
  .pipe(gulp.dest(destDir));

/*
* Hook transpiling step to gulpSrc passed in.
*/
const transpile = (fileGlob, destDir) => {
  const babelRC = JSON.parse(JSON.stringify(getBabelRC()));
  delete babelRC.sourceMaps;

  return gulp.src(fileGlob)
    .pipe(sourcemaps.init())
    .pipe(babel(babelRC))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(destDir));
};
/*
* Count lines. Not implemented.
*/
gulp.task('sloc', () => gulp.src(['src/**/*.js']).pipe(sloc()));

/*
* Linter. Not implemented.
*/
gulp.task('lint', () => (
  gulp.src(['src/**/*.js', '!./node_modules/**'])
  .pipe(eslint({
    extends: 'airbnb/base',
    parser: 'babel-eslint',
    plugins: [
      'babel'
    ],
    rules: {
      'comma-dangle': [2, 'never'],
      'babel/object-shorthand': 1,
      'new-cap': [2, { capIsNew: false }],
      'arrow-body-style': 0
    }
  }))
  .pipe(eslint.format())
  .pipe(eslint.failAfterError())
));

/* ************************************************************************* */
/* Main Tasks                                                                */
/* ************************************************************************* */

/*
* Transpile main source to /dist.
*/
gulp.task('transpile', () => transpile('src/**/*.js', 'dist'));

/*
* Clean/create the dist directory.
*/
gulp.task('clean', () => clean('./dist/*'));

/*
* Copy package.json and README.md to new dist directory.
*/
gulp.task('copy', () => (
  copy(['./package.json', './README.md'], 'dist'))
);

/*
* Bump package.json.
* #These are not exposed in any npm script. Used by release tasks.
*/
const bump = (importance, tag) => gulp.src('./package.json')
  .pipe(bumpVersion({ type: importance, preid: tag }))
  .pipe(gulp.dest('./'));

/*
* Release tasks.
*/
// gulp.task('git-tag', () => (
//   git.tag()
// ));

/*
* Release tasks.
*/
const gitCB = err => {
  if (err) {
    throw err;
  }
};
const commit = msg => git.commit(msg);
const add = glob => gulp.src(glob).pipe(git.add());
const describe = options => git.exec(options, gitCB);
const push = () => git.push();

gulp.task('git-bump-tag', () => {
  const pkg = getPackageJSON();
  const version = `v${pkg.version}`;
  const commitMsg = `Release ${version}`;
  const tagMsg = `Version ${pkg.version}`;
  const describeOpts = { args: 'describe --tags --always --abbrev=1 --dirty=-d' };

  return add('./package.json')
    .pipe(commit(commitMsg))
    .pipe(git.tag(version, tagMsg, gitCB))
    .pipe(describe(describeOpts))
    .pipe(push());
});

/*
* Release tasks.
*/
gulp.task('prerelease', () => bump('prerelease', 'beta'));
gulp.task('patch', () => bump('patch'));
gulp.task('major', () => bump('major'));
gulp.task('minor', () => bump('minor'));

/*
* Release task that update package.json according to what the release does
* according to SemVer and transpile the code.
*/
const release = importance => runSequence(
  importance,
  'git-bump-tag',
  'clean',
  ['transpile', 'copy']
);

/*
* Core release tasks.
*/
gulp.task('release-patch', () => release('patch'));
gulp.task('release-minor', () => release('minor'));
gulp.task('release-major', () => release('major'));
gulp.task('release-prerelease', () => release('prerelease'));

/*
* Default build for main. No bump.
*/
gulp.task('default', () => runSequence(
  'clean',
  ['transpile', 'copy']
));
