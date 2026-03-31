import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 编译后为 dist/src/*.js，仓库根目录为 dist 的上一级 */
const projectRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(projectRoot, '.env') });
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(projectRoot, '.env.production'), override: true });
}
