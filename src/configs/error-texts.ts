export const ErrorTexts = {
  SKIP_DEFAULT_FALLBACK_MSG: '',
  ERROR_INPUT_NOT_A_FILE: '您刚才选择的不是一个有效的文件，请重新选择',
  ERROR_WHISPER_CALL: '字幕提取任务出错，请重试',
  ERROR_ON_REQ_TRANS_ABORT_TASK: '字幕提取任务已终止',
  ERROR_INVALID_FILE_TYPE: '您刚才选择的不是一个有效的视频或音频文件，请重新选择',
  ERROR_TRANSLATE_ALI_NO_SETTINGS: '没找到阿里翻译的配置信息，请确认是否已经完成配置',
  ERROR_TRANSLATE_ALI_REQ_FAIL: '阿里翻译过程中发生未知错误，请尝试重试翻译',
  ERROR_TRANSLATE_ALI_REQ_ERROR_CODE: '阿里翻译接口发生错误，请尝试重试翻译',
  ERROR_TRANSLATE_BAIDU_NO_SETTINGS: '没找到百度翻译的配置信息，请确认是否已经完成配置',
  ERROR_TRANSLATE_BAIDU_REQ_FLOW_CONTROL: '百度翻译接口请求频率过于频繁，请降低您的调用频率，或进行身份认证后切换为高级版/尊享版',
  ERROR_TRANSLATE_BAIDU_REQ_IP_BLOCK: '百度翻译接口触发风控，当前IP可能被临时封禁，原因可能是因为当前IP尝试使用了多个百度翻译账号',
  ERROR_TRANSLATE_BAIDU_REQ_FAIL: '百度翻译过程中发生未知错误，请尝试重试翻译',
  ERROR_TRANSLATE_BAIDU_REQ_ERROR_CODE: '百度翻译接口发生错误，请尝试重试翻译',
  ERROR_TRANSLATE_YOUDAO_NO_SETTINGS: '没找到网易有道翻译的配置信息，请确认是否已经完成配置',
  ERROR_TRANSLATE_YOUDAO_REQ_FLOW_CONTROL: '网易有道翻译请求频率过于频繁，请稍后再试',
  ERROR_TRANSLATE_YOUDAO_REQ_FAIL: '网易有道翻译过程中发生错误，请尝试重试翻译',
  ERROR_TRANSLATE_YOUDAO_REQ_ERROR_CODE: '网易有道翻译接口发生错误，请尝试重试翻译',

  ERROR_TRANSLATE_DEEPL_NO_SETTINGS: '没找到DeepL翻译的配置信息，请确认是否已经完成配置',
  ERROR_TRANSLATE_DEEPL_REQ_FLOW_CONTROL: 'DeepL翻译请求频率过于频繁，请稍后再试',
  ERROR_TRANSLATE_DEEPL_QUOTA_EXCEEDED: 'DeepL翻译配额用完了，请前往官网账号升级账户或增加配额',
  ERROR_TRANSLATE_DEEPL_FORBIDDEN: 'DeepL翻译无权限，请确认配置信息中，是否不小心打开了付费版的开关',
  ERROR_TRANSLATE_DEEPL_REQ_FAIL: 'DeepL翻译过程中发生错误，请尝试重试翻译',
  ERROR_TRANSLATE_DEEPL_REQ_ERROR_CODE: 'DeepL翻译接口发生错误，请尝试重试翻译',

  ERROR_GET_USER_INFO_STATUS_CODE: '登录遇到问题了，请过一会儿再试或者咨询客服人员',
  ERROR_GET_USER_INFO_ERR_CODE: '登录遇到问题了，请稍后再试或者咨询客服人员',
  ERROR_GET_USER_INFO_CAUGHT: '登录遇到问题了，请咨询客服人员',
};

export function getErrorTexts(errno: string) {
  const value = ErrorTexts[errno as keyof typeof ErrorTexts];
  return value === undefined ? '遇到错误了，请稍后重试' : value;
}
