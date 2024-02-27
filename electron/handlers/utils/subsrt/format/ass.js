//Compatible format
import ssa from './ssa.js';

var FORMAT_NAME = "ass";

export default {
  name: FORMAT_NAME,
  helper: ssa.helper,
  detect: ssa.detect,
  parse: ssa.parse,
  build: ssa.build
};
