import Component from '@glimmer/component';

export default class BalanceValueComponent extends Component {
  get rawValue() {
    return String(this.args.value ?? '');
  }

  get hasNumericValue() {
    return /\d/.test(this.rawValue);
  }

  get parts() {
    let rawValue = this.rawValue.trim();
    let spaceIndex = rawValue.lastIndexOf(' ');
    let numberPart = rawValue;
    let suffix = '';

    if (spaceIndex > 0) {
      numberPart = rawValue.slice(0, spaceIndex);
      suffix = rawValue.slice(spaceIndex + 1);
    }

    let [whole, fraction] = numberPart.split('.');

    return {
      whole: whole ?? rawValue,
      fraction: fraction ?? null,
      suffix,
    };
  }
}
