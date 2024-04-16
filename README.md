# Требование
- JQuery ~= 3.7,
- Bootstrap ~= 5.

# Использование
Вам нужно создать таблицу, и в заголовках надо указывать аттрибут `data-st-field`, что означает, для какого поле будет соответствовать заголовок, и если надо `data-st-type` тип поле, по умолчанию это `string`.

Вы еще можете создать заголовок для промежуточных итогов. Вам просто надо указать в аттрибутах `data-st-subtotal`, с значением `2` это количество непустых значений поле, если `9` то сумму непустых значений поле. Этот заголовок должен стоять на том же столбце на котором есть заголовок с `data-st-field`.

Пример: 
```html
<table id="your-table" class="table table-bordered">
    <thead>
        <tr>
            <th data-st-subtotal="2">-</th>
            <th data-st-subtotal="2">-</th>
            <th data-st-subtotal="9">-</th>
            <th data-st-subtotal="2">-</th>
        </tr>
        <tr>
            <th data-st-field="user" data-st-type="string">Пользователь</th>
            <th data-st-field="account">Счёт</th>
            <th data-st-field="sum" data-st-type="number">Сумма</th>
            <th data-st-field="paid_at" data-st-type="date">Дата</th>
        </tr>
    </thead>
    <tbody id="rows">
        <tr id="last-row">
            <td colspan="5">
                <div style="height: 10px;"></div>
            </td>
        </tr>
    </tbody>
</table>
```

После того как вы создали таблицу, c помощью JQuery получить таблицу и вызвать `smartTable` или `smartTableWithVirtualScroll`.

Пример:
```js
$("#your-table").smartTableWithVirtualScroll({
    name: "user-payments-table",
    firstShowRows: "intersected",
    activeColumns: [],
    defaultOrder: [{"field": "paid_at", "sort": "desc"}],
    unloadTypes: [
        {
            html: `<i class="fa-solid fa-file-excel"></i> Изьятие (новый)`,
            type: "mandatory-payment-seizures-xlsx-1"
        }
    ],
    unloadUrl: "/some/unload/url",
    lastRowTarget: "#last-row",
    rowsTarget: "#rows",
    getValuesUrl: "/some/get-values/url",
    getRowsUrl: "/some/get-rows/url",
    getSubtotalsUrl: "/some/get-subtotals/url",
    loadingHtml: `
        <tr>
            <td class="text-center" colspan="4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </td>
        </tr>
    `,
    getTr(row) {
        return `
            <tr>
                <td>${row.user.name}</td>
                <td>${row.account.name}</td>
                <td>${row.sum}</td>
                <td>${row.datetime}</td>
            </tr>
        `;
    }
});
```

# Функций
- `smartTable`
- `smartTableWithVirtualScroll`
- `smartTableReload`
- `smartTableUpdateSubtotals`
- `smartTableUpdateFieldValues`
- `smartTableResetFilters`

