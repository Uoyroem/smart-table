

$.fn.smartTable = function (options) {
  const $smartTable = this;
  $smartTable.addClass("smart-table");
  $("td, th", $smartTable).addClass("smart-table__cell active");
  $("th", $smartTable).addClass("smart-table__th")
  const $settings = $(`
    <div class="dropdown smart-table__settings">
      <button class="btn btn-sm" data-bs-auto-close="outside" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-solid fa-gears"></i>
      </button>
      <ul class="dropdown-menu">
        <li>
          <button class="btn dropdown-item smart-table__reset-button">Сбросить фильтр</button>
        </li>
        <li>
          <div class="btn-group dropend w-100">
            <button type="button" class="btn dropdown-item dropdown-toggle" data-bs-auto-close="outside" data-bs-toggle="dropdown" aria-expanded="false">
              Показать или скрыть столбцы
            </button>
            <ul class="dropdown-menu">
              <div class="smart-table__column-toggle-checkboxes mx-3"></div>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  `);
  $smartTable.before($settings);
  const $columnToggleCheckboxes = $(".smart-table__column-toggle-checkboxes", $settings);
  $(".smart-table__reset-button", $settings).on("click", async function () {
    fieldValuesList = [];
    order = [];
    await showRows();
    $settings.dropdown("hide");
  });
  const activeColumnFields = new Set(Array.from($(`.smart-table__cell.active:not([data-st-field=""])`, this)).map(cell => $(cell).data("stField")));
  $("th", $smartTable).each(function () {
    const field = $(this).data("stField");
    if (field) {
      const id = `${field}-toggle-checkbox`;
      const checkbox = $(`
        <div class="form-check form-switch">
          <input class="form-check-input smart-table__column-toggle-checkbox" type="checkbox" role="switch" id="${id}" checked>
          <label class="form-check-label" for="${id}">${$(this).html()}</label>
        </div>
      `).find(".smart-table__column-toggle-checkbox").on("change", function () {
        const checked = $(this).prop("checked");
        if (checked) {
          activeColumnFields.add(field);
        } else {
          activeColumnFields.delete(field);
        }
        const checkboxes = $(".smart-table__column-toggle-checkbox:checked");
        checkboxes.prop("disabled", checkboxes.length === 1);

        $(`.smart-table__cell[data-st-field="${field}"]`, $smartTable).toggleClass("active", checked);
      }).end();
      $columnToggleCheckboxes.append(checkbox);
    }
  });

  const $menu = $(`
    <div class="dropdown smart-table__menu fw-normal">
      <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" data-bs-auto-close="false" aria-expanded="false">
        <i class="fa-solid fa-caret-down"></i>
      </button>
      <ul class="dropdown-menu">
        <li class="mb-2">
          <button class="btn dropdown-item smart-table__menu-sort-button">
            <div class="row">
              <div class="col-1">
                <span class="smart-table__menu-sort-order text-primary-emphasis fw-bold">
                </span>
                <span class="smart-table__menu-sort-button-icon">
                  <i class="fa-solid fa-sort"></i>
                </span>
              </div>
              <div class="col-11">
                Сортировать
              </div>
            </div>
          </button>
        </li>
        <li>
          <div class="mx-2">
            <button class="btn btn-sm btn-link smart-table__menu-value-check-all">
              Выделить все
              </button>
              <button class="btn btn-sm btn-link smart-table__menu-value-uncheck-all">
              Сбросить
            </button>
            <div class="position-relative mb-2">
              <input type="search" class="form-control smart-table__menu-value-search-input"/>
              
                
              <i class="position-absolute fa-solid fa-magnifying-glass" style="top: 30%; right: 5%"></i>
             
            </div>
            
            <ul class="list-group list-group-flush smart-table__menu-value-checkboxes border rounded">
              
            </ul>
          </div>
        </li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <div class="text-end mx-2">
            <button class="btn btn-sm btn-outline-primary cancel-button">
              Отмена
            </button>
            <button class="btn btn-sm btn-primary submit-button">
              Принять
            </button>
          </div>
        </li>
      </ul>
    </div>
  `);
  $smartTable.append($menu);

  let $activeTh = null;
  $(`thead th`).mouseenter(function () {
    $activeTh = $(this);
    $menu.addClass("active");
    $menu.appendTo(this);
  }).mouseleave(function () {
    $menu.removeClass("active");
    $menu.dropdown("hide");
  });

  const $menuSearchInput = $(".smart-table__menu-value-search-input", $menu);
  function getSearchQueryValueCheckboxes(shouldMatchSearchQuery = true) {
    const searchQuery = $menuSearchInput.val();
    return $(".smart-table__menu-value-checkbox", $menu).filter(function () {
      const isMatched = $(this).val().toLowerCase().includes(searchQuery.toLowerCase());
      return shouldMatchSearchQuery ? isMatched : !isMatched;
    });
  }

  function showSearchQueryResults() {
    const matchedCheckboxes = getSearchQueryValueCheckboxes();
    $(".smart-table__menu-empty-value").toggleClass("d-none", matchedCheckboxes.length !== 0);
    matchedCheckboxes.closest(".list-group-item").removeClass("d-none");
    getSearchQueryValueCheckboxes(false).closest(".list-group-item").addClass("d-none");
  }

  $menuSearchInput.on("input", function () {
    $activeTh.data("search-query", $(this).val());
    showSearchQueryResults();
  });

  const $menuValueCheckboxes = $(".smart-table__menu-value-checkboxes", $menu);
  let fieldValuesList = [];
  $menu.on("shown.bs.dropdown", async function () {
    newOrder = JSON.parse(JSON.stringify(order));
    $menuSearchInput.val($activeTh.data("search-query"));
    $activeTh.data("newSort", $activeTh.data("sort"));
    changeSortIcon();
    changeOrder();
    $menuValueCheckboxes.html(`
      <li class="list-group-item text-center">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </li>
    `);
    const field = $activeTh.data("stField");
    const type = $activeTh.data("stType");
    let values = await options.getValues(field, fieldValuesList);
    values = Array.from(new Set(values)).map(function (value) {
      switch (type) {
        case "number":
          return parseFloat(value);
        case "date":
          return new Date(new Date(value).toDateString());
        default:
          return value;
      }
    });
    values.sort(function (a, b) {
      switch (type) {
        case "number":
        case "date":
          return a - b;
        default:
          return options.collator ? options.collator.compare(a || '', b || '') : (a || '').toString().localeCompare((b || '').toString());
      }
    });
    $menuValueCheckboxes.empty();
    for (let value of values) {
      if (!value) {
        if ($menuValueCheckboxes.find(`.smart-table__menu-value-checkbox[value=""]`).length !== 0) {
          continue;
        }
        $menuValueCheckboxes.prepend(`
          <li class="list-group-item">
            <div class="form-check">
              <input class="form-check-input smart-table__menu-value-checkbox" type="checkbox" value="" id="empty-checkbox" checked>
              <label class="form-check-label" for="empty-checkbox">
                (Пустые)
              </label>
            </div>
          </li>
        `);
      } else {
        let formattedValue = value;
        switch (type) {
          case "number":
            formattedValue = options.numberFormat ? options.numberFormat.format(formattedValue) : formattedValue;
            break;
          case "date":
            formattedValue = options.dateTimeFormat ? options.dateTimeFormat.format(formattedValue) : formattedValue.toLocaleDateString();
            value = value.toDateString();
            break;
        }
        const id = `checkbox-${value}`;
        $menuValueCheckboxes.append(`
          <li class="list-group-item">
            <div class="form-check">
              <input class="form-check-input smart-table__menu-value-checkbox" type="checkbox" value="${value}" id="${id}" checked>
              <label class="form-check-label" for="${id}">
                ${formattedValue}
              </label>
            </div>
          </li>
        `);
      }
    }
    const fieldValues = fieldValuesList.find(fieldValues => fieldValues.field === field);
    if (fieldValues) {
      $(".smart-table__menu-value-checkbox", $menu).each(function () {
        $(this).prop("checked", fieldValues.exclude.length === 0 ? fieldValues.include.includes($(this).val()) : !fieldValues.exclude.includes($(this).val()));
      });
    }
    $menuValueCheckboxes.append(`
      <li class="list-group-item smart-table__menu-empty-value d-none text-center">
        Ничего не найдено
      </li>
    `);
    showSearchQueryResults();
  });

  $menu.on("hidden.bs.dropdown", function () {
    $menuValueCheckboxes.empty();
    $activeTh.data("newSort", null);
    newOrder = null;
    $activeTh = null;
  });

  const $menuButtonSortIcon = $(".smart-table__menu-sort-button-icon", $menu);
  function changeSortIcon() {
    const sort = $activeTh.data("newSort");
    if (!sort) {
      $menuButtonSortIcon.html(`<i class="fa-solid fa-sort"></i>`);
    } else if (sort === "asc") {
      $menuButtonSortIcon.html(`<i class="fa-solid fa-sort-up"></i>`);
    } else {
      $menuButtonSortIcon.html(`<i class="fa-solid fa-sort-down"></i>`);
    }
  }
  let order = [];
  let newOrder = null;
  const $menuButtonSortOrder = $(".smart-table__menu-sort-order", $menu);
  function changeOrder() {
    const field = $activeTh.data("stField");
    const sort = $activeTh.data("newSort");
    const fieldSort = newOrder.find(fieldSort => fieldSort.field == field);
    let index = null;
    if (fieldSort) {
      index = newOrder.indexOf(fieldSort);
      if (sort) {
        fieldSort.sort = sort;
      } else {
        newOrder.splice(index, 1);
        index = null;
      }
    } else if (sort) {
      index = newOrder.length;
      newOrder.push({
        field,
        sort
      });
    }
    $menuButtonSortOrder.html(index != null ? index + 1 : "");
  }
  $(".smart-table__menu-sort-button", $menu).on("click", function () {
    const sort = $activeTh.data("newSort");
    if (!sort) {
      $activeTh.data("newSort", "asc");
    } else if (sort === "asc") {
      $activeTh.data("newSort", "desc");
    } else {
      $activeTh.data("newSort", null);
    }
    changeSortIcon();
    changeOrder();
  });

  $(".cancel-button", $menu).on("click", function () {
    $menu.dropdown("hide");
  });

  async function showRows() {
    try {
      await options.showRows(fieldValuesList, order);
    } catch (error) {
      console.error(error);
    }
  }

  $(".submit-button", $menu).on("click", async function () {
    $activeTh.data("sort", $activeTh.data("newSort"));
    order = newOrder;
    const field = $activeTh.data("stField");
    const matchedCheckboxes = $(".smart-table__menu-value-checkbox:checked", $menu);
    const unmatchedCheckboxes = $(".smart-table__menu-value-checkbox:not(:checked)", $menu);
    const fieldValues = fieldValuesList.find(fieldValues => fieldValues.field === field);
    if (unmatchedCheckboxes.length === 0) {
      if (fieldValues) {
        fieldValuesList.splice(fieldValuesList.indexOf(fieldValues), 1);
      }
    } else if (unmatchedCheckboxes.length > matchedCheckboxes.length) {
      const include = Array.from(matchedCheckboxes).map(matchedCheckbox => $(matchedCheckbox).val());
      if (fieldValues) {
        fieldValues.include = include;
        fieldValues.exclude = [];
      } else {
        fieldValuesList.push({
          field,
          include,
          exclude: []
        })
      }
    } else {
      const exclude = Array.from(unmatchedCheckboxes).map(unmatchedCheckbox => $(unmatchedCheckbox).val());
      if (fieldValues) {
        fieldValues.include = [];
        fieldValues.exclude = exclude;
      } else {
        fieldValuesList.push({
          field,
          include: [],
          exclude
        })
      }
    }
    await showRows();
    $menu.dropdown("hide");
  });

  $(".smart-table__menu-value-check-all").on("click", function () {
    getSearchQueryValueCheckboxes().prop("checked", true);
  });

  $(".smart-table__menu-value-uncheck-all").on("click", function () {
    getSearchQueryValueCheckboxes().prop("checked", false);
  });
  showRows();
  // Active and disable columns

  // // Menu open and close
  // let $activeMenuButton = null;
  // $(".smart-table__cell .smart-table__menu-button", this).on("click", function (event) {
  //   event.stopPropagation();
  //   if ($activeMenuButton == null) {
  //     $menu.addClass("active");
  //   }
  //   else if ($activeMenuButton.is($(this))) {
  //     $menu.removeClass("active");
  //     $activeMenuButton = null;
  //     $(this).trigger("st-menu-closed");
  //     return;
  //   }
  //   console.log(this);
  //   const offset = $(this).offset();
  //   const smartTableContainerOffset = $smartTableContainer.offset();
  //   offset.top -= smartTableContainerOffset.top;
  //   offset.left -= smartTableContainerOffset.left;
  //   offset.top += $(this).outerHeight();
  //   $menu.css(offset);
  //   $(this).trigger("st-menu-opened");
  //   $activeMenuButton = $(this);
  // });
  // $menu.on("click", function (event) {
  //   event.stopPropagation();
  // });
  // $(document).on("click", function () {
  //   $menu.removeClass("active");
  //   $activeMenuButton = null;
  //   $(this).trigger("st-menu-closed");
  // });
};

$.fn.smartTableWithVirtualScroll = function (options) {
  this.smartTable({
    async getValues(field, fieldValuesList) {
      const response = await fetch(options.getValuesUrl, {
        method: "POST",
        body: JSON.stringify({
          field,
          fieldValuesList,
        }),
      });
      const data = await response.json();
      return data.values;
    },
    reset() {
      this.next = options.getRowsUrl
    },
    async getRows(fieldValuesList, order) {
      if (this.next) {
        const response = await fetch(this.next, {
          method: "POST",
          body: JSON.stringify({
            fieldValuesList,
            order
          }),
        });
        const data = await response.json();
        this.next = data.next;
        return data.rows;
      }
      return null;
    },
    async insertRows(fieldValuesList, order) {
      const $lastRow = $(options.lastRowTarget);
      const $loadingTr = $lastRow.before(options.loadingHtml).prev();
      const rows = await this.getRows(fieldValuesList, order);
      $loadingTr.remove();
      if (rows) {
        for (const row of rows) {
          $lastRow.before(options.getTr(row));
        }
      }
    },
    async showRows(fieldValuesList, order) {
      if (this.observer) {
        this.observer.unobserve($(options.lastRowTarget)[0]);
      }
      const $rows = $(options.rowsTarget);
      $("tr", $rows).not(options.lastRowTarget).remove();
      const observer = new IntersectionObserver(async (entries, observer) => {
        if (entries[0].isIntersecting) {
          observer.unobserve($(options.lastRowTarget)[0]);
          await this.insertRows(fieldValuesList, order);
          observer.observe($(options.lastRowTarget)[0]);
        }
      });
      this.observer = observer;
      this.reset();
      await this.insertRows(fieldValuesList, order);
      observer.observe($(options.lastRowTarget)[0]);
    },
    ...options
  });
};