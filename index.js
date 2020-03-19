const fs = require('fs');
const path = require('path');

class DependencyAnalyze {
  constructor(options) {
    if (!options.extensions) {
      throw new Error('extensions param needed!');
    }
    const { extensions, context, outputPath } = options;
    const ext = Array.isArray(extensions) ? extensions : [extensions];
    this.checkExtensions = ext;
    this.context = context ? path.resolve(context) : process.cwd();
    this.excludeDirReg = /[\//]node_modules[\//]/;
    this.outputPath = outputPath;

    this.unreferencedResouce = this._allCandidateResource(this.context);
  }
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap('dependency-analyze', nmf => {
      nmf.hooks.afterResolve.tapAsync('dependency-analyze', (data, cb) => {
        const index = this.unreferencedResouce.findIndex(it => it === data.resource)
        if (index > -1) {
          this.unreferencedResouce.splice(index, 1);
        }
        cb();
      })
    });
    compiler.hooks.emit.tapAsync('dependency-analyze', (compilation, cb) => {
      this._removeDistResource();
      const content = JSON.stringify(this.unreferencedResouce);
      compilation.emitAsset('unusedResource.json', {
        source() { return content },
        size() { return Buffer.from(content).length }
      });
      cb();
    });
  }
  _allCandidateResource(context) {
    if (!fs.existsSync(context)) {
      throw new Error('context not exists!');
    }
    if (this.excludeDirReg.test(context)) {
      return [];
    }
    let res = [];
    const files = fs.readdirSync(context);
    for (let i = 0; i < files.length; i++) {
      const filePath = path.resolve(context, files[i]);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const extension = path.extname(filePath)
        if (this.checkExtensions.includes(extension)) {
          res.push(filePath)
        }
      } else if (stats.isDirectory()) {
        res = res.concat(this._allCandidateResource(filePath));
      }
    }
    return res;
  }
  _removeDistResource() {
    const outputPath = path.resolve(this.outputPath);
    for (let i = 0; i < this.unreferencedResouce.length; i++) {
      if (this.unreferencedResouce[i].startsWith(outputPath)) {
        this.unreferencedResouce.splice(i, 1);
        i--;
      }
    }
  }
}

module.exports = DependencyAnalyze;
