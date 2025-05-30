/* globals Backbone, _, (...?) */
const notPresentText = "No candidate found for the current role";
const notPresentButtonText = "No candidate found for the current role";
const notPresentClass = "btn-outline-primary";
const activeFrameSpanClass = "btn-dark";
const activeRoleSpanClass = "btn-dark";

const AnswerSpanStatus = {
  OK: "ok",
  NOT_CANDIDATE: "not candidate",
  NOT_PRECEDING: "not preceding",
  NOT_SELECTED: "not selected",
};

//  ****  Span checking functions ******

// return True if span1 is exactly same as span2
function spanEquals(span1, span2) {
  return (
    span1.sentenceIndex == span2.sentenceIndex &&
    span1.startToken == span2.startToken &&
    span1.endToken == span2.endToken
  );
}

// return True if span1 contains span2
function spanContains(span1, span2) {
  return (
    span1.sentenceIndex === span2.sentenceIndex &&
    span1.startToken <= span2.startToken &&
    span1.endToken >= span2.endToken
  );
}

// Check whether the input span contains the input token (token of length 1)
// inputs: span, sentence_index, token_index
function spanContainsToken(span, si, ti) {
  return spanContains(span, {
    sentenceIndex: si,
    startToken: ti,
    endToken: ti + 1,
  });
}

// Check whether span1 is before span2 (can also be in previous sentence)
function spanPrecedes(span1, span2) {
  return (
    span1.sentenceIndex < span2.sentenceIndex ||
    (span1.sentenceIndex === span2.sentenceIndex &&
      span1.endToken <= span2.startToken)
  );
}

// check whether either span1 or span2 have an overlapping token at the intersection
//  s1: ......
//  S2:      ......
//
//  OR
//
//  s1:      ......
//  s2: ......
function spanOverlaps(span1, span2) {
  return (
    spanContainsToken(span1, span2.sentenceIndex, span2.startToken) ||
    spanContainsToken(span2, span1.sentenceIndex, span1.startToken)
  );
}

// check whether both span1 and span2 start at the same token
function spanStartEquals(span1, span2) {
  return (
    span1.sentenceIndex === span2.sentenceIndex &&
    span1.startToken === span2.startToken
  );
}

//check whether both span1 and span2 end at the same token
function spanEndEquals(span1, span2) {
  return (
    span1.sentenceIndex === span2.sentenceIndex &&
    span1.endToken === span2.endToken
  );
}

var DataModel = Backbone.Model.extend({
  defaults: {
    activeFrameSpanIndex: 0,
    activeFrameIndex: -1,
    activeRoleIndexSource: 0,
    activeRoleIndexPassage: 0,
    dragStartSentence: -1,
    dragStartToken: -1,
    dragLastSentence: -1,
    dragLastToken: -1,
    unselect: false,
    sourceAnswerSpans: {},
    passageAnswerSpans: {},
    showPassage: true,
    showPlainText: false,
    scrollTopValue: 0,
  },
  initialize: function () {
    // fetch the frame highlighted span, we assume there is only one for each document:
    activeFrameSpanIndex = this.attributes.activeFrameSpanIndex;
    this.attributes.frameSpan =
      this.attributes.frameSpans[activeFrameSpanIndex];

    // Initialize the roles for both source and passage for each frames
    this.attributes.rolesPassage = {};
    this.attributes.roleDefinitionsPassage = {};
    this.attributes.roleExamplesPassage = {};

    this.attributes.rolesSource = {};
    this.attributes.roleDefinitionsSource = {};
    this.attributes.roleExamplesSource = {};

    for (let i = 0; i < this.attributes.frameNames.length; i++) {
      var currentFrameName = this.attributes.frameNames[i];
      // passage roles
      this.attributes.rolesPassage[currentFrameName] =
        this.attributes.listCoreRoles[i].slice();
      this.attributes.roleDefinitionsPassage[currentFrameName] =
        this.attributes.listRoleDefinitions[i].slice();
      this.attributes.roleExamplesPassage[currentFrameName] =
        this.attributes.listRoleExamples[i].slice();
      // source roles
      this.attributes.rolesSource[currentFrameName] =
        this.attributes.listCoreRoles[i].slice();
      this.attributes.roleDefinitionsSource[currentFrameName] =
        this.attributes.listRoleDefinitions[i].slice();
      this.attributes.roleExamplesSource[currentFrameName] =
        this.attributes.listRoleExamples[i].slice();
    }

    // Initialize answer Spans for all frames (both passage and source)
    for (let i = 0; i < this.attributes.frameNames.length; i++) {
      var currentFrameName = this.attributes.frameNames[i];
      var currentFrameRoles = this.attributes.listCoreRoles[i];

      this.attributes.passageAnswerSpans[currentFrameName] = [];
      this.attributes.sourceAnswerSpans[currentFrameName] = [];

      // For each role, add answer spans
      for (var role of currentFrameRoles) {
        // passage answerSpan
        this.attributes.passageAnswerSpans[currentFrameName].push({
          frameSpan: this.attributes.frameSpan,
          role: role,
          notPresent: false,
          sentenceIndex: -1,
          startToken: -1,
          endToken: -1,
          status: AnswerSpanStatus.OK,
          scrollTopValue: 0,
        });

        // source answerSpan
        this.attributes.sourceAnswerSpans[currentFrameName].push({
          frameSpan: {},
          role: role,
          notPresent: false,
          sentenceIndex: -1,
          startToken: -1,
          endToken: -1,
          status: AnswerSpanStatus.OK,
          scrollTopValue: 0,
        });
      }
    }

    // Apply silver labels if they exist
    if (this.attributes.silverLabels) {
      // Get the first frame name to apply silver labels to
      var firstFrameName = this.attributes.frameNames[0];

      // Apply passage spans from silver labels
      if (this.attributes.silverLabels.passageSpans) {
        for (
          var roleIndex = 0;
          roleIndex < this.attributes.passageAnswerSpans[firstFrameName].length;
          roleIndex++
        ) {
          var roleSpan =
            this.attributes.passageAnswerSpans[firstFrameName][roleIndex];
          var role = roleSpan.role;

          // Check if this role has a silver label
          if (this.attributes.silverLabels.passageSpans[role]) {
            var silverSpan = this.attributes.silverLabels.passageSpans[role];

            // Apply the silver label data
            roleSpan.sentenceIndex = silverSpan.sentenceIndex;
            roleSpan.startToken = silverSpan.startToken;
            roleSpan.endToken = silverSpan.endToken;
            roleSpan.notPresent = false; // It's present since we have values
            roleSpan.status = AnswerSpanStatus.OK;
          }
        }
      }

      // Apply source spans from silver labels
      if (this.attributes.silverLabels.sourceSpans) {
        for (
          var roleIndex = 0;
          roleIndex < this.attributes.sourceAnswerSpans[firstFrameName].length;
          roleIndex++
        ) {
          var roleSpan =
            this.attributes.sourceAnswerSpans[firstFrameName][roleIndex];
          var role = roleSpan.role;

          // Check if this role has a silver label
          if (this.attributes.silverLabels.sourceSpans[role]) {
            var silverSpan = this.attributes.silverLabels.sourceSpans[role];

            // Apply the silver label data
            roleSpan.sentenceIndex = silverSpan.sentenceIndex;
            roleSpan.startToken = silverSpan.startToken;
            roleSpan.endToken = silverSpan.endToken;
            roleSpan.notPresent = false; // It's present since we have values
            roleSpan.status = AnswerSpanStatus.OK;
          }
        }
      }
    }

    // initialize certain attributes as per the first frame
    var first_frame_name = this.attributes.frameNames[0];
    this.attributes.activeSourceAnswerSpans =
      this.attributes.sourceAnswerSpans[first_frame_name];
    this.attributes.activePassageAnswerSpans =
      this.attributes.passageAnswerSpans[first_frame_name];
    this.attributes.activeCoreRoles = this.attributes.listCoreRoles[0];

    this.attributes.activeRolesPassage =
      this.attributes.rolesPassage[first_frame_name];
    this.attributes.activeRoleDefinitionsPassage =
      this.attributes.roleDefinitionsPassage[first_frame_name];
    this.attributes.activeRoleExamplesPassage =
      this.attributes.roleExamplesPassage[first_frame_name];
    this.attributes.activeRoleIndexPassage = 0;

    this.attributes.activeRolesSource =
      this.attributes.rolesSource[first_frame_name];
    this.attributes.activeRoleDefinitionsSource =
      this.attributes.roleDefinitionsSource[first_frame_name];
    this.attributes.activeRoleExamplesSource =
      this.attributes.roleExamplesSource[first_frame_name];
    this.attributes.activeRoleIndexSource = 0;

    // length of the largest sentence in this document
    var sourceMaxLength = _.max(
      _.map(this.attributes.sourceSentences, "length"),
    );
    var passageMaxLength = _.max(
      _.map(this.attributes.passageSentences, "length"),
    );

    // Sort source candidate spans
    // first by start token, then by end token
    this.attributes.sourceCandidateSpans = _.sortBy(
      this.attributes.sourceCandidateSpans,
      function (span) {
        return (
          span.sentenceIndex * sourceMaxLength * sourceMaxLength +
          span.startToken * sourceMaxLength +
          span.endToken
        );
      },
    );

    // Sort passage candidate spans
    // first by start token, then by end token
    this.attributes.passageCandidateSpans = _.sortBy(
      this.attributes.passageCandidateSpans,
      function (span) {
        return (
          span.sentenceIndex * passageMaxLength * passageMaxLength +
          span.startToken * passageMaxLength +
          span.endToken
        );
      },
    );

    // Remap all variables to a system prediction
    // This ensures a pre-highlighted frame
    this.remapAllVariablestoSystemPrediction();
  },

  // remap All variables to a system predicted frame using the input data
  // This prediction is based on an earlier frame id task
  remapAllVariablestoSystemPrediction: function () {
    var systemPrediction = this.attributes.frame_id_annotation;
    for (let i = 0; i < this.attributes.frameNames.length; i++) {
      if (this.attributes.frameNames[i] == systemPrediction) {
        this.remapAllVariables(i);
      }
    }
  },

  // remap all role variables wrt input activeFrameIndex
  remapAllVariables: function (activeFrameIndex) {
    // initialize all frame and role propoerties to current activeFrameIndex
    var activeFrameName = this.attributes.frameNames[activeFrameIndex];
    this.attributes.activeFrameIndex = activeFrameIndex;
    // needed for adding and deleting roles
    this.attributes.activeCoreRoles =
      this.attributes.listCoreRoles[activeFrameIndex];
    // passage roles
    this.attributes.activeRolesPassage =
      this.attributes.rolesPassage[activeFrameName];
    this.attributes.activeRoleDefinitionsPassage =
      this.attributes.roleDefinitionsPassage[activeFrameName];
    this.attributes.activeRoleExamplesPassage =
      this.attributes.roleExamplesPassage[activeFrameName];
    this.attributes.activeRoleIndexPassage = 0;
    // source roles
    this.attributes.activeRolesSource =
      this.attributes.rolesSource[activeFrameName];
    this.attributes.activeRoleDefinitionsSource =
      this.attributes.roleDefinitionsSource[activeFrameName];
    this.attributes.activeRoleExamplesSource =
      this.attributes.roleExamplesSource[activeFrameName];
    this.attributes.activeRoleIndexSource = 0;

    // map current answer spans
    this.attributes.activeSourceAnswerSpans =
      this.attributes.sourceAnswerSpans[activeFrameName];
    this.attributes.activePassageAnswerSpans =
      this.attributes.passageAnswerSpans[activeFrameName];
  },

  // clear values of the input AnswerSpan index
  clearAnswerSpan: function (answerIndex) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      this.attributes.activePassageAnswerSpans[answerIndex].sentenceIndex = -1;
      this.attributes.activePassageAnswerSpans[answerIndex].startToken = -1;
      this.attributes.activePassageAnswerSpans[answerIndex].endToken = -1;
      this.attributes.activePassageAnswerSpans[answerIndex].scrollTopValue = 0;
    } else {
      this.attributes.activeSourceAnswerSpans[answerIndex].sentenceIndex = -1;
      this.attributes.activeSourceAnswerSpans[answerIndex].startToken = -1;
      this.attributes.activeSourceAnswerSpans[answerIndex].endToken = -1;
      this.attributes.activeSourceAnswerSpans[answerIndex].scrollTopValue = 0;
    }
  },

  getSpanText: function (sentences, span, capped = false) {
    if (span.sentenceIndex !== -1) {
      var s = "";
      for (var ti = span.startToken; ti < span.endToken; ti++) {
        s += sentences[span.sentenceIndex][ti] + " ";
      }
      // if capped, get span Text only for first 7 tokens
      if (capped) {
        var total_span_length = span.endToken - span.startToken;
        var s = "";
        var count_tokens = 0;
        for (var ti = span.startToken; ti < span.endToken; ti++) {
          count_tokens += 1;
          s += sentences[span.sentenceIndex][ti] + " ";
          if (count_tokens > 7 && count_tokens < total_span_length) {
            s += "...";
            break;
          }
        }
      }
      return s;
    } else {
      return "";
    }
  },

  // get the text of frame span
  getFrameSpanText: function (sentences, answerIndex) {
    return this.getSpanText(sentences, this.attributes.frameSpans[answerIndex]);
  },

  getAnswerSpanText: function (answerSpans, answerIndex, capped = false) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      var sentences = this.attributes.passageSentences;
    } else {
      var sentences = this.attributes.sourceSentences;
    }

    return this.getSpanText(
      sentences,
      answerSpans[answerIndex],
      (capped = capped),
    );
  },

  isPartOfAnswerSpan: function (answerSpans, answerIndex, si, ti) {
    return spanContainsToken(answerSpans[answerIndex], si, ti);
  },

  // check whether the input token is part of the input answer span
  isPartOfFrameSpan: function (answerIndex, si, ti) {
    return spanContainsToken(this.attributes.frameSpans[answerIndex], si, ti);
  },

  // at the input answerIndex, set the input token (of length 1)
  setTokenAnswerIndex: function (answerIndex, sentenceIndex, tokenIndex) {
    var showPassage = this.attributes.showPassage;

    if (showPassage) {
      var answerSpan = this.attributes.activePassageAnswerSpans[answerIndex];
    } else {
      var answerSpan = this.attributes.activeSourceAnswerSpans[answerIndex];
    }

    // if the answerspan was not present, set the new tokenindex as per input
    if (answerSpan.sentenceIndex === -1) {
      answerSpan.sentenceIndex = sentenceIndex;
      answerSpan.startToken = tokenIndex;
      answerSpan.endToken = tokenIndex + 1;
      answerSpan.scrollTopValue = this.attributes.scrollTopValue;
      // if the answerspan sentence already present,
      // then put start token as min of (dragStartToken, tokenindex)
      // why is this done?
      // this is updating the highlighted text (if something is already selected)
    } else if (answerSpan.sentenceIndex === sentenceIndex) {
      answerSpan.startToken = _.min([
        this.attributes.dragStartToken,
        tokenIndex,
      ]);
      answerSpan.endToken =
        _.max([this.attributes.dragStartToken, tokenIndex]) + 1;
      answerSpan.scrollTopValue = this.attributes.scrollTopValue;
    }
    // why is this initialzed at false for every answer in the first place
    // no candidate flips this attribute
    answerSpan.notPresent = false;
  },

  // check if the answerspan is before the frame span
  answerSpanIsPreceding: function (answerSpan) {
    return spanPrecedes(answerSpan, answerSpan.frameSpan);
  },

  answerSpanIsCandidate: function (candidateSpans, answerSpan) {
    return _.some(candidateSpans, function (candidateSpan) {
      return spanEquals(answerSpan, candidateSpan);
    });
  },

  validateAnswerSpans: function () {
    var sourceAnswerSpans = this.attributes.activeSourceAnswerSpans;
    var sourceCandidateSpans = this.attributes.sourceCandidateSpans;

    var passageAnswerSpans = this.attributes.activePassageAnswerSpans;
    var passageCandidateSpans = this.attributes.passageCandidateSpans;

    // Validate Passage Answer Spans
    for (var answerSpan of passageAnswerSpans) {
      answerSpan.status = AnswerSpanStatus.OK;
      if (answerSpan.sentenceIndex === -1) {
        if (!answerSpan.notPresent) {
          answerSpan.status = AnswerSpanStatus.NOT_SELECTED;
        }
      } else {
        if (!this.answerSpanIsCandidate(passageCandidateSpans, answerSpan)) {
          answerSpan.status = AnswerSpanStatus.NOT_CANDIDATE;
          // console.log(answerSpan.status)
        }
      }
    }

    // Validate Source Answer Spans
    for (var answerSpan of sourceAnswerSpans) {
      answerSpan.status = AnswerSpanStatus.OK;
      if (answerSpan.sentenceIndex === -1) {
        if (!answerSpan.notPresent) {
          answerSpan.status = AnswerSpanStatus.NOT_SELECTED;
        }
      } else {
        if (!this.answerSpanIsCandidate(sourceCandidateSpans, answerSpan)) {
          answerSpan.status = AnswerSpanStatus.NOT_CANDIDATE;
          // console.log(answerSpan.status)
        }
      }
    }

    var passage_validate = !_.some(passageAnswerSpans, function (span) {
      return span.status !== AnswerSpanStatus.OK;
    });

    var source_validate = !_.some(sourceAnswerSpans, function (span) {
      return span.status !== AnswerSpanStatus.OK;
    });

    // Returns True only when all answerspan's status is OK
    return passage_validate && source_validate;
  },

  toggleNotPresent: function (answerIndex) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      this.attributes.activePassageAnswerSpans[answerIndex].notPresent =
        !this.attributes.activePassageAnswerSpans[answerIndex].notPresent;
      return this.attributes.activePassageAnswerSpans[answerIndex].notPresent;
    } else {
      this.attributes.activeSourceAnswerSpans[answerIndex].notPresent =
        !this.attributes.activeSourceAnswerSpans[answerIndex].notPresent;
      return this.attributes.activeSourceAnswerSpans[answerIndex].notPresent;
    }
  },

  // set the drag attributes to the input values
  setDrag: function (startSentence, startToken, lastSentence, lastToken) {
    this.attributes.dragStartSentence = startSentence;
    this.attributes.dragStartToken = startToken;
    this.attributes.dragLastSentence = lastSentence;
    this.attributes.dragLastToken = lastToken;
  },

  // update the drag ending attributes
  updateDrag: function (lastSentence, lastToken) {
    this.attributes.dragLastSentence = lastSentence;
    this.attributes.dragLastToken = lastToken;
  },

  getRelevantCandidateSpans: function (
    candidateSpans,
    answerSpans,
    answerIndex,
  ) {
    var answerSpan = answerSpans[answerIndex];
    return _.filter(candidateSpans, function (candidateSpan) {
      return spanOverlaps(candidateSpan, answerSpan);
    });
  },

  // add extra Role as selected from dropdown
  addExtraRole: function (roleName, roleIndex) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      var roles = this.attributes.activeRolesPassage;
    } else {
      var roles = this.attributes.activeRolesSource;
    }
    // find the current number of present roles with the same name as the input:
    var existingCountRole = 0;
    var finalCount = [];
    for (let i = 0; i < roles.length; i++) {
      current_role = roles[i];
      current_role_prefix = current_role.split("__")[0];
      if (current_role_prefix == roleName) {
        existingCountRole += 1;
        finalCount.push(existingCountRole);
      }
    }

    // get the new index of the role number
    var newCountRole = finalCount.pop();

    // add the role to the list of roles
    var newRoleName = roleName + "__" + (newCountRole + 1).toString();

    if (showPassage) {
      this.attributes.activeRolesPassage.push(newRoleName);
      // append copies of definition and example for the extra role
      var currentRoleDefinition =
        this.attributes.activeRoleDefinitionsPassage[roleIndex];
      var currentRoleExample =
        this.attributes.activeRoleExamplesPassage[roleIndex];
      this.attributes.activeRoleDefinitionsPassage.push(currentRoleDefinition);
      this.attributes.activeRoleExamplesPassage.push(currentRoleExample);

      // add answerSpan for the extra Role
      this.attributes.activePassageAnswerSpans.push({
        frameSpan: this.attributes.frameSpans[0],
        role: newRoleName,
        notPresent: false,
        sentenceIndex: -1,
        startToken: -1,
        endToken: -1,
        status: AnswerSpanStatus.OK,
        scrollTopValue: 0,
      });
    } else {
      this.attributes.activeRolesSource.push(newRoleName);
      // append copies of definition and example for the extra role
      var currentRoleDefinition =
        this.attributes.activeRoleDefinitionsSource[roleIndex];
      var currentRoleExample =
        this.attributes.activeRoleExamplesSource[roleIndex];
      this.attributes.activeRoleDefinitionsSource.push(currentRoleDefinition);
      this.attributes.activeRoleExamplesSource.push(currentRoleExample);

      // add answerSpan for the extra Role
      this.attributes.activeSourceAnswerSpans.push({
        frameSpan: this.attributes.frameSpans[0],
        role: newRoleName,
        notPresent: false,
        sentenceIndex: -1,
        startToken: -1,
        endToken: -1,
        status: AnswerSpanStatus.OK,
        scrollTopValue: 0,
      });
    }
  },

  // delete extra Role if no candidate is selected
  deleteExtraRole: function (roleIndex) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      var roleName = this.attributes.activeRolesPassage[roleIndex];
    } else {
      var roleName = this.attributes.activeRolesSource[roleIndex];
    }

    // If the role is an extra role (i.e. not in CoreRoles)
    if (!this.attributes.activeCoreRoles.includes(roleName)) {
      if (showPassage) {
        current_total_roles = this.attributes.activeRolesPassage.length;
        // remove the role from roles, definitions, examples
        this.attributes.activeRolesPassage = [
          ...this.attributes.activeRolesPassage.slice(0, roleIndex),
          ...this.attributes.activeRolesPassage.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        this.attributes.activeRoleDefinitionsPassage = [
          ...this.attributes.activeRoleDefinitionsPassage.slice(0, roleIndex),
          ...this.attributes.activeRoleDefinitionsPassage.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        this.attributes.activeRoleExamplesPassage = [
          ...this.attributes.activeRoleExamplesPassage.slice(0, roleIndex),
          ...this.attributes.activeRoleExamplesPassage.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        // remove the answer span for the extra role
        this.attributes.activePassageAnswerSpans = [
          ...this.attributes.activePassageAnswerSpans.slice(0, roleIndex),
          ...this.attributes.activePassageAnswerSpans.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
      }
      // ShowSource
      else {
        current_total_roles = this.attributes.activeRolesSource.length;
        // remove the role from roles, definitions, examples
        this.attributes.activeRolesSource = [
          ...this.attributes.activeRolesSource.slice(0, roleIndex),
          ...this.attributes.activeRolesSource.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        this.attributes.activeRoleDefinitionsSource = [
          ...this.attributes.activeRoleDefinitionsSource.slice(0, roleIndex),
          ...this.attributes.activeRoleDefinitionsSource.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        this.attributes.activeRoleExamplesSource = [
          ...this.attributes.activeRoleExamplesSource.slice(0, roleIndex),
          ...this.attributes.activeRoleExamplesSource.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
        // remove the answer span for the extra role
        this.attributes.activeSourceAnswerSpans = [
          ...this.attributes.activeSourceAnswerSpans.slice(0, roleIndex),
          ...this.attributes.activeSourceAnswerSpans.slice(
            roleIndex + 1,
            current_total_roles,
          ),
        ];
      }

      this.renameExtraRoles();

      return true;
    } else {
      return false;
    }
  },

  // Rename Extra Role names (fix indexes if they are not in order)
  renameExtraRoles: function () {
    // Run a loop over all RoleNames
    // initialize a dict for counting the freq of each role
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      var roleIndexes = {};
      // initialize the counts of all roles to be equal to 1
      for (let i = 0; i < this.attributes.activeRolesPassage.length; i++) {
        current_role = this.attributes.activeRolesPassage[i];
        current_role_prefix = current_role.split("__")[0];
        roleIndexes[current_role_prefix] = 1;
      }
      // change role names based on frequency of role
      for (let i = 0; i < this.attributes.activeRolesPassage.length; i++) {
        current_role = this.attributes.activeRolesPassage[i];
        current_role_split_list = current_role.split("__");
        // re-assign role names for extra roles based on indexes
        if (current_role_split_list.length != 1) {
          current_role_prefix = current_role_split_list[0];
          //increment the role index
          roleIndexes[current_role_prefix] += 1;
          // fetch the new role index value
          current_index_count = roleIndexes[current_role_prefix];
          // concat the prefix with the current index value
          this.attributes.activeRolesPassage[i] = current_role_prefix.concat(
            "__",
            current_index_count.toString(),
          );
        }
      }
    } else {
      var roleIndexes = {};
      // initialize the counts of all roles to be equal to 1
      for (let i = 0; i < this.attributes.activeRolesSource.length; i++) {
        current_role = this.attributes.activeRolesSource[i];
        current_role_prefix = current_role.split("__")[0];
        roleIndexes[current_role_prefix] = 1;
      }
      // change role names based on frequency of role
      for (let i = 0; i < this.attributes.activeRolesSource.length; i++) {
        current_role = this.attributes.activeRolesSource[i];
        current_role_split_list = current_role.split("__");
        // re-assign role names for extra roles based on indexes
        if (current_role_split_list.length != 1) {
          current_role_prefix = current_role_split_list[0];
          //increment the role index
          roleIndexes[current_role_prefix] += 1;
          // fetch the new role index value
          current_index_count = roleIndexes[current_role_prefix];
          // concat the prefix with the current index value
          this.attributes.activeRolesSource[i] = current_role_prefix.concat(
            "__",
            current_index_count.toString(),
          );
        }
      }
    }
  },

  // set the active role index to the input index
  setActiveRoleIndex: function (activeRoleIndex) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      this.attributes.activeRoleIndexPassage = activeRoleIndex;
    } else {
      this.attributes.activeRoleIndexSource = activeRoleIndex;
    }
  },

  // step forward active role index
  stepActiveRoleIndex: function (forward) {
    var showPassage = this.attributes.showPassage;

    if (showPassage) {
      if (forward) {
        this.setActiveRoleIndex(
          (this.attributes.activeRoleIndexPassage + 1) %
            this.attributes.activePassageAnswerSpans.length,
        );
      } else {
        // why this? if forward is not True, what does this mean? cycling back to first index?
        this.setActiveRoleIndex(
          this.attributes.activeRoleIndexPassage === 0
            ? this.attributes.activePassageAnswerSpans.length - 1
            : this.attributes.activeRoleIndexPassage - 1,
        );
      }
    }
    // Source
    else {
      if (forward) {
        this.setActiveRoleIndex(
          (this.attributes.activeRoleIndexSource + 1) %
            this.attributes.activeSourceAnswerSpans.length,
        );
      } else {
        // why this? if forward is not True, what does this mean? cycling back to first index?
        this.setActiveRoleIndex(
          this.attributes.activeRoleIndexSource === 0
            ? this.attributes.activeSourceAnswerSpans.length - 1
            : this.attributes.activeRoleIndexSource - 1,
        );
      }
    }
  },

  stepSelection: function (forward) {
    var showPassage = this.attributes.showPassage;
    if (showPassage) {
      var numSentences = this.attributes.passageSentences.length;
      var sentenceLengths = _.map(this.attributes.passageSentences, "length");
      var activeFrameSpan =
        this.attributes.activePassageAnswerSpans[
          this.attributes.activeFrameIndex
        ];
      var activeRoleIndex = this.attributes.activeRoleIndexPassage;
      var activeRoleSpan =
        this.attributes.activePassageAnswerSpans[activeRoleIndex];
    } else {
      var numSentences = this.attributes.sourceSentences.length;
      var sentenceLengths = _.map(this.attributes.sourceSentences, "length");
      var activeFrameSpan =
        this.attributes.activeSourceAnswerSpans[
          this.attributes.activeFrameIndex
        ];
      var activeRoleIndex = this.attributes.activeRoleIndexSource;
      var activeRoleSpan =
        this.attributes.activeSourceAnswerSpans[activeRoleIndex];
    }

    // a list of token spans for each token in each sentences (length = 1)
    var tokenSpans = _.flatten(
      _.map(_.range(numSentences), function (sentenceIndex) {
        return _.map(
          _.range(sentenceLengths[sentenceIndex]),
          function (tokenIndex) {
            return {
              sentenceIndex: sentenceIndex,
              startToken: tokenIndex,
              endToken: tokenIndex + 1,
            };
          },
        );
      }),
    );

    // if length of tokenspans > 0
    // move the highlighted text with arow keys
    if (tokenSpans.length > 0) {
      var spanBoundaryEquals = spanEndEquals;
      if (!forward) {
        spanBoundaryEquals = spanStartEquals;
        tokenSpans.reverse();
      }
      var newTokenSpan =
        tokenSpans[
          activeRoleSpan.sentenceIndex === -1
            ? 0
            : (_.findIndex(tokenSpans, function (tokenSpan) {
                return spanBoundaryEquals(activeRoleSpan, tokenSpan);
              }) +
                1) %
              tokenSpans.length
        ];
      activeRoleSpan.sentenceIndex = newTokenSpan.sentenceIndex;
      activeRoleSpan.startToken = newTokenSpan.startToken;
      activeRoleSpan.endToken = newTokenSpan.endToken;
    }
  },
});

var CandidateListView = Backbone.View.extend({
  el: "#candidate_list",
  events: {
    "click button.clickable": "onClick",
    "click button.add_candidate_btn": "onAddCandidate",
    "click button.submit-custom-candidate": "onSubmitCustomCandidate",
  },

  onAddCandidate: function () {
    var showPassage = this.model.get("showPassage");

    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var activeRoleSpan =
        this.model.attributes.activePassageAnswerSpans[activeRoleIndex];

      var new_candidate = {
        endToken: activeRoleSpan.endToken,
        sentenceIndex: activeRoleSpan.sentenceIndex,
        startToken: activeRoleSpan.startToken,
      };

      // length of the largest sentence in this document
      var maxLength = _.max(
        _.map(this.model.attributes.passageSentences, "length"),
      );
      // add new candidate to candidate list
      this.model.attributes.passageCandidateSpans.push(new_candidate);
      // Sort source candidate spans
      // first by start token, then by end token
      this.model.attributes.passageCandidateSpans = _.sortBy(
        this.model.attributes.passageCandidateSpans,
        function (span) {
          return (
            span.sentenceIndex * maxLength * maxLength +
            span.startToken * maxLength +
            span.endToken
          );
        },
      );
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var activeRoleSpan =
        this.model.attributes.activeSourceAnswerSpans[activeRoleIndex];
      var new_candidate = {
        endToken: activeRoleSpan.endToken,
        sentenceIndex: activeRoleSpan.sentenceIndex,
        startToken: activeRoleSpan.startToken,
      };
      // length of the largest sentence in this document
      var maxLength = _.max(
        _.map(this.model.attributes.sourceSentences, "length"),
      );
      // add new candidate to candidate list
      this.model.attributes.sourceCandidateSpans.push(new_candidate);
      // Sort source candidate spans
      // first by start token, then by end token
      this.model.attributes.sourceCandidateSpans = _.sortBy(
        this.model.attributes.sourceCandidateSpans,
        function (span) {
          return (
            span.sentenceIndex * maxLength * maxLength +
            span.startToken * maxLength +
            span.endToken
          );
        },
      );
    }
    this.model.trigger("change");
  },

  // select the custom span
  onSubmitCustomCandidate: function (event) {
    var customText = this.$("#direct-candidate-input").val().trim();
    if (customText) {
      var showPassage = this.model.attributes.showPassage;
      var activeRoleIndex = showPassage
        ? this.model.attributes.activeRoleIndexPassage
        : this.model.attributes.activeRoleIndexSource;
      var activeRoleSpan = showPassage
        ? this.model.attributes.activePassageAnswerSpans[activeRoleIndex]
        : this.model.attributes.activeSourceAnswerSpans[activeRoleIndex];

      var customSpan = {
        endToken: activeRoleSpan.endToken,
        startToken: activeRoleSpan.startToken,
        sentenceIndex: activeRoleSpan.sentenceIndex,
        text: customText,
        isCustom: true,
      };

      if (showPassage) {
        this.model.attributes.passageCandidateSpans.push(customSpan);
      } else {
        this.model.attributes.sourceCandidateSpans.push(customSpan);
      }

      this.$("#direct-candidate-input").val("");

      // Trigger model update
      this.model.trigger("change");
    }
  },

  // select a given candidate using numeric keys
  selectCandidateByKey: function (key) {
    var keyInt = parseInt(key);
    if (key == "n") {
      this.selectCandidate(-1, -1);
    } else if (!isNaN(keyInt) && 0 < keyInt && keyInt < 10) {
      var button = this.$("button").filter(function () {
        return $(this).data("index") == keyInt;
      });
      if (button !== undefined) {
        var startToken = button.data("start_token");
        var endToken = button.data("end_token");
        this.selectCandidate(startToken, endToken);
      }
    }
  },

  // select a candidate using a given start token and end token
  selectCandidate: function (startToken, endToken, text, isCustom) {
    var showPassage = this.model.attributes.showPassage;
    var activeFrameIndex = this.model.attributes.activeFrameIndex;
    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
    }

    var customStatus = isCustom ? true : false;

    // when no candidate is present
    if (isCustom === undefined && (startToken === -1 || endToken === -1)) {
      // notPresent toggles to True from the default False value
      var notPresent = this.model.toggleNotPresent(activeRoleIndex);
      if (notPresent) {
        // clear answer spans for the role with no candidate selected
        this.model.clearAnswerSpan(activeRoleIndex);
        // delete extra role
        role_deleted = this.model.deleteExtraRole(activeRoleIndex);
        if (role_deleted) {
          // if role was deleted changed the index to previous role
          if (showPassage) {
            this.model.attributes.activeRoleIndexPassage =
              this.model.attributes.activeRoleIndexPassage - 1;
          } else {
            this.model.attributes.activeRoleIndexSource =
              this.model.attributes.activeRoleIndexSource - 1;
          }
        }
      }
    } else {
      if (showPassage) {
        this.model.attributes.activePassageAnswerSpans[
          activeRoleIndex
        ].startToken = startToken;
        this.model.attributes.activePassageAnswerSpans[
          activeRoleIndex
        ].endToken = endToken;
        this.model.attributes.activePassageAnswerSpans[activeRoleIndex].text =
          text;
        this.model.attributes.activePassageAnswerSpans[
          activeRoleIndex
        ].isCustom = customStatus;
      } else {
        this.model.attributes.activeSourceAnswerSpans[
          activeRoleIndex
        ].startToken = startToken;
        this.model.attributes.activeSourceAnswerSpans[
          activeRoleIndex
        ].endToken = endToken;
        this.model.attributes.activeSourceAnswerSpans[activeRoleIndex].text =
          text;
        this.model.attributes.activeSourceAnswerSpans[
          activeRoleIndex
        ].isCustom = customStatus;
      }
    }
    this.model.trigger("change");
  },

  onClick: function (event) {
    var startToken = $(event.currentTarget).data("start_token");
    var endToken = $(event.currentTarget).data("end_token");
    var spanText = $(event.currentTarget).data("text");
    var isCustom = $(event.currentTarget).data("isCustom");

    this.selectCandidate(startToken, endToken, spanText, isCustom);
  },

  render: function () {
    this.$el.empty();

    var activeFrameIndex = this.model.attributes.activeFrameIndex;
    var showPassage = this.model.attributes.showPassage;

    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var activeRoleSpan =
        this.model.attributes.activePassageAnswerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var candidateSpans = this.model.attributes.passageCandidateSpans;
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
      var sentences = this.model.attributes.passageSentences;
      this.$el.append(
        $("<h5>").text("Valid Overlapping Candidates in Passage"),
      );
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var activeRoleSpan =
        this.model.attributes.activeSourceAnswerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var candidateSpans = this.model.attributes.sourceCandidateSpans;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var sentences = this.model.attributes.sourceSentences;
      this.$el.append($("<h5>").text("Valid Overlapping Candidates in Source"));
    }

    // Add text input form for direct candidate entry
    var inputForm = $("<div>").addClass("candidate-input-form mb-3");
    var textInput = $("<input>")
      .addClass("form-control mb-2")
      .attr("type", "text")
      .attr("placeholder", "Paste from Plain Text...")
      .attr("id", "direct-candidate-input");

    var submitButton = $("<button>")
      .addClass("btn btn-primary submit-custom-candidate")
      .attr("type", "button")
      .text("Add Custom Candidate");

    inputForm.append(textInput, submitButton);
    this.$el.append(inputForm);

    var index = 1;
    if (activeRoleSpan.status === AnswerSpanStatus.NOT_SELECTED) {
      this.$el.append(
        $("<div>")
          .addClass("alert alert-warning")
          .text(
            "Select a mention in the text to see the candidates that overlap it.",
          ),
      );
    } else {
      var relevantCandidateSpans = this.model.getRelevantCandidateSpans(
        candidateSpans,
        answerSpans,
        activeRoleIndex,
      );

      if (relevantCandidateSpans.length === 0) {
        this.$el.append(
          $("<div>")
            .addClass("alert alert-warning")
            .text("No overlapping candidates."),
        );

        // Add button for manually adding candidates
        if (activeRoleSpan.sentenceIndex != -1 && !activeRoleIsValid) {
          this.$el.append(
            $("<button>")
              .addClass("btn wrap_btn btn-dark text-left add_candidate_btn")
              .addClass(notPresentClass)
              .addClass(activeRoleSpan.notPresent ? "active" : "")
              .attr("type", "button")
              .data("start_token", -1)
              .data("end_token", -1)
              .data("index", -1)
              .text("Add currently selected text as a candidate"),
          );
        }
      } else {
        // Add button for manually adding candidates
        if (activeRoleSpan.sentenceIndex != -1 && !activeRoleIsValid) {
          this.$el.append(
            $("<button>")
              .addClass("btn wrap_btn btn-dark text-left add_candidate_btn")
              .addClass(notPresentClass)
              .addClass(activeRoleSpan.notPresent ? "active" : "")
              .attr("type", "button")
              .data("start_token", -1)
              .data("end_token", -1)
              .data("index", -1)
              .text("Add currently selected text as a candidate"),
          );
        }

        for (var candidateSpan of relevantCandidateSpans) {
          var usableIndex = 0 < index && index < 10;
          var spanText = candidateSpan.isCustom
            ? candidateSpan.text
            : this.model.getSpanText(sentences, candidateSpan);

          //adding buttons for candidate selection
          this.$el.append(
            $("<button>")
              .addClass("btn wrap_btn text-left clickable")
              .addClass(
                spanEquals(activeRoleSpan, candidateSpan)
                  ? "btn-dark"
                  : "btn-outline-dark",
              )
              .attr("type", "button")
              .data("start_token", candidateSpan.startToken)
              .data("end_token", candidateSpan.endToken)
              .data("index", usableIndex ? index : -1)
              .data("text", spanText)
              .data("isCustom", candidateSpan.isCustom)
              .text((usableIndex ? "(" + index + ") " : "") + spanText),
          );
          ++index;
        }
      }
    }

    this.$el.append(
      $("<button>")
        .addClass("btn wrap_btn text-left clickable answer_not_present_button")
        .addClass(notPresentClass)
        .addClass(activeRoleSpan.notPresent ? "active" : "")
        .attr("type", "button")
        .data("start_token", -1)
        .data("end_token", -1)
        .data("index", -1)
        .text(notPresentButtonText),
    );

    return this;
  },
});

var EventView = Backbone.View.extend({
  el: "#event_list",

  events: {
    "click .select_frame_button": "onSelectFrame",
  },

  onSelectFrame: function (event) {
    var selectedFrameIndex = $(event.currentTarget).data("frame_index");
    this.model.remapAllVariables(selectedFrameIndex);
    this.model.trigger("change");
  },

  render: function () {
    this.$el.empty();
    var activeFrameIndex = this.model.get("activeFrameIndex");
    var activeRoleIndexSource = this.model.get("activeRoleIndexSource");
    var activeRoleIndexPassage = this.model.get("activeRoleIndexPassage");
    var activeFrameSpanIndex = this.model.get("activeFrameSpanIndex");

    var activeRoleSpanSource =
      this.model.attributes.activeSourceAnswerSpans[activeRoleIndexSource];
    var activeRoleIsValidSource =
      activeRoleSpanSource.status === AnswerSpanStatus.OK;

    var activeRoleSpanPassage =
      this.model.attributes.activePassageAnswerSpans[activeRoleIndexPassage];
    var activeRoleIsValidPassage =
      activeRoleSpanPassage.status === AnswerSpanStatus.OK;

    var activeFrameDefinition =
      this.model.attributes.frameDefinitions[activeFrameIndex];
    var activeFrameExample =
      this.model.attributes.frameExamples[activeFrameIndex];

    // ***********    Event Navigation Div start **************** //
    var eventSelectDiv = $("<div>").addClass("clearfix");

    var framesDiv = $("<div>")
      .addClass("float-left")
      .append($("<i>").addClass("mr-2 mt-1").text("Select Event Type:"));
    // Get text of each role
    for (
      var frameIndex = 0;
      frameIndex < this.model.attributes.frameNames.length;
      frameIndex++
    ) {
      var frameDiv = $("<div>")
        .addClass("select_frame_button btn wrap_btn mr-2 mt-1")
        .addClass(
          frameIndex === activeFrameIndex
            ? "btn-success font-weight-bold"
            : "btn-outline-success",
        )
        .data("frame_index", frameIndex)
        .text(this.model.attributes.frameNames[frameIndex]);
      framesDiv.append(frameDiv);
    }
    // frame navigation
    eventSelectDiv.append(framesDiv);
    this.$el.append(eventSelectDiv);
    // ***********    Event Navigation Div ends **************** //

    // ***********    Event Status Div starts **************** //
    var statusDiv = $("<div>").addClass("clearfix mr-2 mt-1 ");

    // Active Event Text
    if (activeFrameIndex != -1) {
      statusDiv.append($("<div>").addClass("clearfix"));
      statusDiv.append(
        $("<div>")
          .addClass("mb-2 float-left")
          .append($("<i>").addClass("mr-2 mt-1").text("Active Event Type:"))
          .append(
            $("<div>")
              .addClass(
                "btn wrap_btn p-1 mr-4 mt-1 font-weight-bold" +
                  (true ? " btn-event" : " btn-event"),
              )
              .text(this.model.attributes.frameNames[activeFrameIndex]),
          ),
      );

      // Event Definition Text
      statusDiv.append($("<div>").addClass("clearfix"));
      statusDiv.append(
        $("<div>")
          .addClass("mb-2 float-left")
          .append($("<i>").addClass("mr-2 mt-1").text("Event Definition:")),
      );

      statusDiv.append(
        $("<div>").addClass("mb-2 float-left").text(activeFrameDefinition),
      );

      // Event Example Text
      // Display role example
      statusDiv.append($("<div>").addClass("clearfix"));
      statusDiv.append(
        $("<div>")
          .addClass("mb-2 float-left")
          .append($("<i>").addClass("mr-2 mt-1").text("Event Example:")),
      );
      statusDiv.append(activeFrameExample);
    }
    // ***********    Event Status Div ends **************** //

    // **** ADD Event URL ********* //
    // More details about the event
    var eventUrlDiv = $("<div>").addClass("clearfix mr-2 mt-1 ");
    // add frame name .xml at the end
    var activeFrameName = this.model.attributes.frameNames[activeFrameIndex];
    var event_url =
      "https://framenet.icsi.berkeley.edu/fnReports/data/frame/" +
      activeFrameName +
      ".xml";

    //  Add a  hyperlink to the event url
    // add a hyperlink to the event url in the text with the frame name
    var eventUrl = $("<a>")
      .attr("href", event_url)
      .attr("target", "_blank")
      .text(
        'Click here to know more details about the "' +
          activeFrameName +
          '" Event Type',
      );
    eventUrlDiv.append(eventUrl);

    this.$el.append(statusDiv);
    this.$el.append(eventUrlDiv);

    return this;
  },
});

var SentenceView = Backbone.View.extend({
  el: "#sentence_list",
  events: {
    "mousedown .token": "onStartDrag",
    "mouseleave .token": "onDragLeave",
    "mouseenter .token": "onDrag",
    "click #passage_toggle": "onTogglePassage",
    "click #source_toggle": "onToggleSource",
    "click #plain_text_toggle": "onTogglePlainText",
  },

  onTogglePassage: function (event) {
    this.model.attributes.showPassage = true;
    this.model.attributes.showPlainText = false;
    this.model.trigger("change");
  },

  onToggleSource: function (event) {
    this.model.attributes.showPassage = false;
    this.model.attributes.showPlainText = false;
    this.model.trigger("change");
  },

  onTogglePlainText: function (event) {
    this.model.attributes.showPassage = false;
    this.model.attributes.showPlainText = true;
    this.model.trigger("change");
  },

  onStartDrag: function (event) {
    this.crossSentenceWarningShown = false;
    var showPassage = this.model.attributes.showPassage;

    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
    }

    var si = $(event.currentTarget).data("sentence_index");
    var ti = $(event.currentTarget).data("token_index");

    this.model.attributes.unselect =
      activeRoleSpan.sentenceIndex == si &&
      activeRoleSpan.startToken == ti &&
      activeRoleSpan.endToken == ti + 1;

    this.model.clearAnswerSpan(activeRoleIndex);
    this.model.setTokenAnswerIndex(activeRoleIndex, si, ti);
    this.model.setDrag(si, ti, si, ti);
    this.model.trigger("change");
  },

  onDrag: function (event) {
    var showPassage = this.model.attributes.showPassage;

    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
    }

    var si = $(event.currentTarget).data("sentence_index");
    var ti = $(event.currentTarget).data("token_index");

    if (
      si === this.model.attributes.dragStartSentence &&
      (si != this.model.attributes.dragLastSentence ||
        ti != this.model.attributes.dragLastToken)
    ) {
      this.model.setTokenAnswerIndex(activeRoleIndex, si, ti);
      this.model.trigger("change");
    }
    this.model.updateDrag(si, ti);
  },

  onDragLeave: function (event) {
    this.model.attributes.unselect = false;
  },

  render: function () {
    this.$el.empty();

    var showPassage = this.model.attributes.showPassage;
    var showPlainText = this.model.attributes.showPlainText;
    var frameSpanIndex = 0; // by default we assume only one framespan exists in a doc
    var activeFrameIndex = this.model.get("activeFrameIndex");
    var token_class = "token_button";

    if (showPlainText == false && showPassage == true) {
      var sentences = this.model.get("passageSentences");
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var headDiv =
        '<div class="btn-group btn-group-toggle" data-toggle="buttons"><label for="passage_text" id="passage_toggle" class="btn btn-outline-dark active"><input type="radio" name="options" id="passage_text" autocomplete="off" checked> Passage Text</label><label for="source_text" id="source_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="source_text" autocomplete="off"> Source Text</label><label for="plain_text" id="plain_text_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="plain_text" autocomplete="off"> Plain Text</label></div>';
    } else if (showPlainText == false && showPassage == false) {
      var sentences = this.model.get("sourceSentences");
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var headDiv =
        '<div class="btn-group btn-group-toggle" data-toggle="buttons"><label for="passage_text" id="passage_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="passage_text" autocomplete="off" checked> Passage Text</label><label for="source_text" id="source_toggle" class="btn btn-outline-dark active"><input type="radio" name="options" id="source_text" autocomplete="off"> Source Text</label><label for="plain_text" id="plain_text_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="plain_text" autocomplete="off"> Plain Text</label></div>';
    } else {
      var passage_text = this.model.get("passageSentences");
      var source_text = this.model.get("sourceSentences");
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var activeRoleSpan = answerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var headDiv =
        '<div class="btn-group btn-group-toggle" data-toggle="buttons"><label for="passage_text" id="passage_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="passage_text" autocomplete="off" checked> Passage Text</label><label for="source_text" id="source_toggle" class="btn btn-outline-dark"><input type="radio" name="options" id="source_text" autocomplete="off"> Source Text</label><label for="plain_text" id="plain_text_toggle" class="btn btn-outline-dark active"><input type="radio" name="options" id="plain_text" autocomplete="off"> Plain Text</label></div>';
    }

    // ***********   Text Div starts **************** //
    var textDiv = $("<div>").addClass("mb-3").addClass("scrollClass border");

    var activeQueryElement = null;

    var model = this.model;
    // Store scrolltop position of text:
    textDiv.scroll(function () {
      if (textDiv.html().length) {
        scroll_t = textDiv.scrollTop();
        // update model scroll when the mouse is scrolled
        model.attributes.scrollTopValue = scroll_t;
      }
    });

    var paragraph = $("<p>");

    if (showPlainText) {
      var passageTitle = $("<h5>")
        .addClass("font-weight-bold")
        .text("Passage Text");
      paragraph.append(passageTitle);
      for (var si = 0; si < passage_text.length; si++) {
        for (var ti = 0; ti < passage_text[si].length; ti++) {
          var tokenSpan = $("<span>").text(passage_text[si][ti]);
          paragraph.append(tokenSpan);
          var whitespaceSpan = $("<span>").text(" ");
          paragraph.append(whitespaceSpan);
        }
      }

      // Add dividing line
      var divider = $("<hr>").addClass("my-3");
      paragraph.append(divider);

      // Add source text section
      var sourceTitle = $("<h5>")
        .addClass("font-weight-bold")
        .text("Source Text");
      paragraph.append(sourceTitle);
      for (var si = 0; si < source_text.length; si++) {
        for (var ti = 0; ti < source_text[si].length; ti++) {
          var tokenSpan = $("<span>").text(source_text[si][ti]);
          paragraph.append(tokenSpan);
          var whitespaceSpan = $("<span>").text(" ");
          paragraph.append(whitespaceSpan);
        }
      }
    } else {
      for (var si = 0; si < sentences.length; si++) {
        for (var ti = 0; ti < sentences[si].length; ti++) {
          var tokenSpan = $("<span>")
            .addClass("btn token " + token_class)
            .data("sentence_index", si)
            .data("token_index", ti)
            .text(sentences[si][ti]);

          // Highlight the frame event span in passage
          if (showPassage) {
            if (this.model.isPartOfFrameSpan(frameSpanIndex, si, ti)) {
              tokenSpan.addClass("btn-event font-weight-bold");
            }
          }

          // // dark token if answerspan is part of current selection
          if (
            this.model.isPartOfAnswerSpan(answerSpans, activeRoleIndex, si, ti)
          ) {
            tokenSpan.addClass(activeRoleSpanClass);
            if (!activeRoleIsValid) {
              tokenSpan.addClass("disabled");
              // if (activeQueryElement === null) {
              //      activeQueryElement = tokenSpan;
              //     }
            }
          }

          paragraph.append(tokenSpan);
          var whitespaceSpan = $("<span>")
            .addClass("whitespace noselect")
            .text(" ");
          paragraph.append(whitespaceSpan);
        }
      }
    }
    textDiv.append(paragraph);
    // ***********    Text Div ends **************** //
    this.$el.append(headDiv);
    this.$el.append(textDiv);

    // update the scrollTop value for text Div
    textDiv.scrollTop(model.attributes.scrollTopValue);

    // if active role has a valid selected span, then scroll to that span
    if (activeRoleIsValid) {
      textDiv.scrollTop(activeRoleSpan.scrollTopValue);
    }
    // if (activeQueryElement !== null) {
    //     this.model.attributes.scrollToQuery = false;
    //     activeQueryElement[0].scrollIntoView(true);
    //     }

    return this;
  },
});

var RoleView = Backbone.View.extend({
  el: "#role_info",
  events: {
    "click .select_role_button": "onSelectRole",
    "click button.step_role_button": "onStepRole",
    "click .dropdown-item": "onAddRole",
  },

  onStepRole: function (event) {
    var forward = $(event.currentTarget).data("forward");
    this.model.stepActiveRoleIndex(forward);
    this.model.trigger("change");
  },

  onSelectRole: function (event) {
    var roleIndex = $(event.currentTarget).data("role_index");
    this.model.setActiveRoleIndex(roleIndex);
    this.model.trigger("change");
  },

  onAddRole: function (event) {
    var selectedRole = $(event.currentTarget).data("rolename");
    var selectedRoleIndex = $(event.currentTarget).data("roleindex");
    this.model.addExtraRole(selectedRole, selectedRoleIndex);
    this.model.trigger("change");
  },

  render: function () {
    this.$el.empty();

    var showPassage = this.model.attributes.showPassage;
    var frameSpanIndex = 0; // by default we assume only one framespan exists in a doc

    if (showPassage) {
      var sentences = this.model.get("passageSentences");
      var activeFrameIndex = this.model.get("activeFrameIndex");
      var activeRoleIndex = this.model.get("activeRoleIndexPassage");
      var activeRoleSpan =
        this.model.attributes.activePassageAnswerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var activeRoleDefinition =
        this.model.attributes.activeRoleDefinitionsPassage[activeRoleIndex];
      var activeRoleExample =
        this.model.attributes.activeRoleExamplesPassage[activeRoleIndex];
      var roles = this.model.attributes.activeRolesPassage;
      var activeRole = roles[activeRoleIndex];
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
      var activeAnswerSpanText = activeRoleSpan.isCustom
        ? activeRoleSpan.text
        : this.model.getAnswerSpanText(
            answerSpans,
            activeRoleIndex,
            (capped = true),
          );
    } else {
      var sentences = this.model.get("sourceSentences");
      var activeFrameIndex = this.model.get("activeFrameIndex");
      var activeRoleIndex = this.model.get("activeRoleIndexSource");
      var activeRoleSpan =
        this.model.attributes.activeSourceAnswerSpans[activeRoleIndex];
      var activeRoleIsValid = activeRoleSpan.status === AnswerSpanStatus.OK;
      var activeRoleDefinition =
        this.model.attributes.activeRoleDefinitionsSource[activeRoleIndex];
      var activeRoleExample =
        this.model.attributes.activeRoleExamplesSource[activeRoleIndex];
      var roles = this.model.attributes.activeRolesSource;
      var activeRole = roles[activeRoleIndex];
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
      var activeAnswerSpanText = activeRoleSpan.isCustom
        ? activeRoleSpan.text
        : this.model.getAnswerSpanText(
            answerSpans,
            activeRoleIndex,
            (capped = true),
          );
    }

    console.log("sole view span text: " + activeAnswerSpanText);

    // ***********  Active Role Div starts **************** //
    var statusRoleDiv = $("<div>")
      .addClass("mb-1")
      .append($("<i>").addClass("me-2 mt-1").text("Active Role: "))
      .append(
        $("<div>")
          .addClass(
            "btn p-1 me-4 mr-4 mt-1 font-weight-bold" +
              (activeRoleIsValid ? " btn-success" : " btn-danger"),
          )
          .text(activeRole),
      )
      .append($("<i>").addClass("mr-2 mt-1").text("Answer: "))
      .append(
        $("<div>")
          .addClass(
            "btn p-1 me-4 mt-1" +
              (activeRoleIsValid
                ? activeRoleSpan.notPresent
                  ? " btn-primary"
                  : " btn-dark"
                : " btn-dark disabled"),
          )
          .text(
            activeRoleIsValid
              ? activeRoleSpan.notPresent
                ? notPresentText
                : activeAnswerSpanText
              : activeAnswerSpanText + " (invalid)",
          ),
      );

    // ***********    Add Extra role **************** //
    var addRoleButton = $("<div>");
    addRoleButton
      .addClass("mb-2 float-right")
      .append(
        $("<button>")
          .addClass("btn btn-outline-dark dropdown-toggle add_role_button")
          .attr("data-toggle", "dropdown")
          .attr("aria-haspopup", "true")
          .text("Add Role"),
      );
    // add role names
    var roledropDowns = $("<div>").addClass("dropdown-menu");
    for (
      var roleIndex = 0;
      roleIndex < this.model.attributes.activeCoreRoles.length;
      roleIndex++
    ) {
      var roleNameText = $("<a>")
        .addClass("dropdown-item")
        // .attr("href", "#")
        .data("rolename", this.model.attributes.activeCoreRoles[roleIndex])
        .data("roleindex", roleIndex)
        .text(this.model.attributes.activeCoreRoles[roleIndex]);
      roledropDowns.append(roleNameText);
    }
    addRoleButton.append(roledropDowns);
    statusRoleDiv.append(addRoleButton);
    // ***********    Active Role Div ends **************** //

    // ***********    Role Navigation Div start **************** //
    var navDiv = $("<div>").addClass("clearfix");

    var rolesDiv = $("<div>")
      .addClass("float-left")
      .append($("<i>").addClass("mr-2 mt-1").text("Roles:"));
    // Get text of each role

    for (var roleIndex = 0; roleIndex < roles.length; roleIndex++) {
      var answerSpan = answerSpans[roleIndex];
      var isValid = answerSpan.status === AnswerSpanStatus.OK;
      var roleDiv = $("<div>")
        .addClass("select_role_button btn wrap_btn mr-2 mt-1")
        .addClass(
          isValid
            ? roleIndex === activeRoleIndex
              ? "btn-success font-weight-bold"
              : "btn-outline-success"
            : roleIndex === activeRoleIndex
              ? "btn-danger font-weight-bold"
              : "btn-outline-danger",
        )
        .data("role_index", roleIndex)
        .text(roles[roleIndex]);
      rolesDiv.append(roleDiv);
    }
    // role navigation
    navDiv.append(rolesDiv);
    navDiv.append(
      $("<div>")
        .addClass("float-right")
        .append(
          $("<button>")
            .addClass(
              "btn btn-outline-dark ml-1 mt-1 wrap_btn step_role_button ",
            )
            .data("forward", false)
            .text("previous role"),
        )
        .append(
          $("<button>")
            .addClass(
              "btn btn-outline-dark ml-1 mt-1 wrap_btn step_role_button",
            )
            .data("forward", true)
            .text("next role"),
        ),
    );
    // ***********    Role Navigation Div ends **************** //
    // ***********    Role Definition/Example Div ends **************** //
    var roleDefDiv = $("<div>").addClass("clearfix");
    roleDefDiv.append(
      $("<div>")
        .addClass("mb-2 float-left")
        .append($("<i>").addClass("mr-2 mt-1").text("Role Definition:")),
    );
    roleDefDiv.append(activeRoleDefinition);

    // Display role example
    roleDefDiv.append($("<div>").addClass("clearfix"));
    // roleDefDiv.append($('<br>'));
    roleDefDiv.append(
      $("<div>")
        .addClass("mb-2 float-left")
        .append($("<i>").addClass("mr-2 mt-1").text("Role Example:")),
    );
    roleDefDiv.append(activeRoleExample);
    // ***********    Role Definition/Example Div ends **************** //

    if (activeFrameIndex != -1) {
      this.$el.append(statusRoleDiv);
      this.$el.append(navDiv);
      this.$el.append(roleDefDiv);
    }
  },
});

var AppView = Backbone.View.extend({
  el: "#content",
  events: {
    mouseup: "onEndDrag",
  },
  initialize: function () {
    this.candidateListView = new CandidateListView({ model: this.model });
    this.sentenceView = new SentenceView({ model: this.model });
    this.eventView = new EventView({ model: this.model });
    this.roleView = new RoleView({ model: this.model });

    // call render view whenever model changes
    this.listenTo(this.model, "change", this.render);
  },

  onKey: function (event) {
    var oe = event.originalEvent;
    if (!oe.altKey && !oe.ctrlKey && !oe.metaKey) {
      var shift = oe.shiftKey;
      var key = oe.key;
      if (key === "Tab") {
        event.preventDefault();
        // this.model.stepActiveFrameIndex(!shift);
        this.model.stepActiveRoleIndex(!shift);
        this.model.trigger("change");
      } else if (key === "?" || key === "h") {
        event.preventDefault();
        $("#keyboard_shortcuts").modal("toggle");
      } else if (key === "i") {
        event.preventDefault();
        $("#instructions").collapse("toggle");
      } else if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        this.model.stepSelection(key === "ArrowRight");
        this.model.trigger("change");
      } else if ("123456789n".split("").includes(key)) {
        event.preventDefault();
        this.candidateListView.selectCandidateByKey(key);
      }
    }
  },
  onSubmit: function (event) {
    if (this.model.attributes.activeFrameIndex == -1) {
      this.model.trigger("change");
      $("#alerts")
        .attr("class", "alert alert-danger")
        .text("Please select an event type first");
      return false;
    } else if (this.model.validateAnswerSpans()) {
      var activeFrameIndex = this.model.attributes.activeFrameIndex;
      var activeFrameName = this.model.attributes.frameNames[activeFrameIndex];

      var output = {
        annotated_frame: activeFrameName,
        passageAnswerSpans: this.model.attributes.passageAnswerSpans,
        sourceAnswerSpans: this.model.attributes.sourceAnswerSpans,
        annotated_all_model_attributes: this.model.attributes,
      };

      $("#answer_spans").val(JSON.stringify(output));
      $("#alerts").attr("class", "").text("");
      return true;
    } else {
      this.model.trigger("change");
      $("#alerts")
        .attr("class", "alert alert-danger")
        .text(
          'Please ensure a valid candidate or "' +
            notPresentText +
            '" has been selected for all roles in both Passage Text and Source Text.',
        );
      return false;
    }
  },
  render: function () {
    $("#alerts").removeClass();
    $("#alerts").empty();

    this.model.validateAnswerSpans();

    this.sentenceView.render();
    this.eventView.render();
    this.roleView.render();
    this.candidateListView.render();
  },
  onEndDrag: function (event) {
    this.model.setDrag(-1, -1, -1, -1);
    var showPassage = this.model.attributes.showPassage;
    if (showPassage) {
      var activeRoleIndex = this.model.attributes.activeRoleIndexPassage;
      var answerSpans = this.model.attributes.activePassageAnswerSpans;
    } else {
      var activeRoleIndex = this.model.attributes.activeRoleIndexSource;
      var answerSpans = this.model.attributes.activeSourceAnswerSpans;
    }
    if (this.model.attributes.unselect) {
      this.model.clearAnswerSpan(activeRoleIndex);
      this.model.attributes.unselect = false;
      this.model.trigger("change");
    }
  },
});

$(document).ready(function () {
  var dataUrl = getURLParameter("dataUrl") || window.turkleDataUrl;
  if (dataUrl) {
    console.log("Loading data from " + dataUrl);
    $.getJSON(dataUrl, function (data) {
      initializeApp(data);
    });
  } else {
    console.log("Loading data from local file");
    var data = {
      passage_id: "dummy-example-01",
      Spanfinder_frame_prediction: "Hiring",
      frame_id_annotation: "Hiring",
      passageSentences: [
        [
          "He",
          ",",
          "his",
          "cousin",
          ",",
          "and",
          "his",
          "wife",
          "were",
          "all",
          "hired",
          "as",
          "Research",
          "Scientists",
          "by",
          "Microsoft",
          ".",
        ],
      ],
      frameNames: [
        "Firing",
        "Becoming_a_member",
        "Appointing",
        "Arrest",
        "Hiring",
      ],
      frameSpans: [{ sentenceIndex: 0, startToken: 10, endToken: 11 }],
      sourceSentences: [
        [
          "John",
          "Smith",
          "is",
          "a",
          "recent",
          "graduate",
          "of",
          "the",
          "University",
          "of",
          "Washington",
          ".",
        ],
        [
          "He",
          "interned",
          "at",
          "Microsoft",
          "Research",
          "in",
          "Seattle",
          ",",
          "Washington",
          ".",
        ],
        [
          "His",
          "research",
          "interests",
          "include",
          "machine",
          "learning",
          ",",
          "computer",
          "vision",
          ",",
          "and",
          "natural",
          "language",
          "processing",
          ".",
        ],
        [
          "After",
          "6",
          "rounds",
          "of",
          "interviewing",
          ",",
          "he",
          "was",
          "hired",
          "as",
          "a",
          "Research",
          "Scientist",
          "by",
          "Microsoft",
          "to",
          "work",
          "on",
          "their",
          "new",
          "chatbot",
          ".",
        ],
      ],
      passageCandidateSpans: [
        { endToken: 4, sentenceIndex: 0, startToken: 3 },
        { endToken: 8, sentenceIndex: 0, startToken: 7 },
        { endToken: 7, sentenceIndex: 0, startToken: 6 },
        { endToken: 8, sentenceIndex: 0, startToken: 0 },
        { endToken: 16, sentenceIndex: 0, startToken: 15 },
        { endToken: 14, sentenceIndex: 0, startToken: 11 },
        { endToken: 3, sentenceIndex: 0, startToken: 2 },
        { endToken: 10, sentenceIndex: 0, startToken: 9 },
        { endToken: 16, sentenceIndex: 0, startToken: 14 },
      ],
      sourceCandidateSpans: [
        { endToken: 5, sentenceIndex: 3, startToken: 1 },
        { endToken: 11, sentenceIndex: 0, startToken: 9 },
        { endToken: 2, sentenceIndex: 3, startToken: 1 },
        { endToken: 9, sentenceIndex: 1, startToken: 6 },
        { endToken: 5, sentenceIndex: 1, startToken: 3 },
        { endToken: 21, sentenceIndex: 3, startToken: 20 },
        { endToken: 1, sentenceIndex: 1, startToken: 0 },
        { endToken: 21, sentenceIndex: 3, startToken: 15 },
        { endToken: 9, sentenceIndex: 0, startToken: 8 },
        { endToken: 2, sentenceIndex: 0, startToken: 0 },
        { endToken: 9, sentenceIndex: 1, startToken: 2 },
        { endToken: 13, sentenceIndex: 3, startToken: 9 },
        { endToken: 15, sentenceIndex: 3, startToken: 13 },
        { endToken: 9, sentenceIndex: 1, startToken: 8 },
        { endToken: 21, sentenceIndex: 3, startToken: 6 },
        { endToken: 21, sentenceIndex: 3, startToken: 17 },
        { endToken: 7, sentenceIndex: 1, startToken: 6 },
        { endToken: 14, sentenceIndex: 2, startToken: 4 },
        { endToken: 12, sentenceIndex: 3, startToken: 11 },
        { endToken: 3, sentenceIndex: 2, startToken: 0 },
        { endToken: 20, sentenceIndex: 3, startToken: 19 },
        { endToken: 15, sentenceIndex: 3, startToken: 14 },
        { endToken: 11, sentenceIndex: 0, startToken: 7 },
        { endToken: 7, sentenceIndex: 3, startToken: 6 },
      ],
      frameDefinitions: [
        "An Employer ends an employment relationship with an Employee.",
        "A New_member becomes a member of a socially-constructed Group.",
        "A Selector, often an individual in a leadership role, appoints a Official to assume an official Role in an organization (which can be expressed as the Body).",
        "Authorities charge a Suspect, who is under suspicion of having committed a crime (the Charges), and take him\/her into custody.'",
        "An Employer hires an Employee, promising the Employee a certain Compensation in exchange for the performance of a job.",
      ],
      frameExamples: [
        "He <t>fired<\/t> me as annotator for being too slow.",
        "Seven new members and the three countries <t>joined<\/t> the alliance five years ago.",
        "Press secretaries <t>accredit<\/t> journalists to the sessions.",
        "The police <t>arrested<\/t> Harry on charges of manslaughter.",
        "John was <t>hired<\/t> to clean up the file system.",
      ],
      listCoreRoles: [
        ["Employee", "Employer", "Position", "Task"],
        ["New_member", "Group"],
        ["Selector", "Official", "Role", "Function", "Body"],
        ["Charges", "Authorities", "Suspect", "Offense"],
        ["Employee", "Employer", "Task", "Position", "Field"],
      ],
      listRoleDefinitions: [
        [
          "The person who is let go by their <fen>Employer<\/fen>.",
          "The person (or institution) that end an employment relationship with an <fen>Employee<\/fen>.",
          "The label given to a particular type of employment.",
          "The action that the <fen>Employee<\/fen> is relieved from doing for the <fen>Employer<\/fen>\n\n.",
        ],
        [
          "The <fen>New_member<\/fen> becomes a member of a (socially-defined) <fen>Group<\/fen>.",
          "The <fen>Group<\/fen> is a socially-constructed entity composed of members.",
        ],
        [
          "The <fen>Selector<\/fen> is responsible for the appointment of the new official.  Typically, it occurs as the External Argument of verbs.",
          "The <fen>Official<\/fen> is a person appointed to a recognized position.",
          "Frequently, the <fen>Official<\/fen> is referred to only by his\/her role. However, the <fen>Role<\/fen> can be expressed separately from the leader, usually as either a secondary predicate or in a PP Complement (headed by <m>as<\/m>).",
          "The <fen>Function<\/fen> is the purpose the <fen>Official<\/fen> will fufill.",
          "A group of individuals who are elected or appointed to perform some function, and to which the <fen>Official<\/fen> is assigned.",
        ],
        [
          "<fen>Charges<\/fen> identifies a category within the legal system; it is the crime with which the <fen>Suspect<\/fen> is charged.",
          "The <fen>Authorities<\/fen> charge the <fen>Suspect<\/fen> with commiting a crime, and take him\/her into custody.",
          "The <fen>Suspect<\/fen> is taken into custody, under suspicion of having committed a crime.",
          "<fen>Offense<\/fen> identifies the ordinary language use of the reason for which a <fen>Suspect<\/fen> is arrested.",
        ],
        [
          "The person whom the <fen>Employer<\/fen> takes on as an <fen>Employee<\/fen>, obligating them to perform some <fen>Task<\/fen> in order to receive <fen>Compensation<\/fen>.",
          "The person (or institution) that takes on an <fen>Employee<\/fen>, giving them  <fen>Compensation<\/fen> in return for the performance of an assigned <fen>Task<\/fen>.",
          "The action that the <fen>Employee<\/fen> is taken on by the <fen>Employer<\/fen> to do.",
          "The label given to a particular type of employment.",
          "The <fen>Field<\/fen> that the <fen>Employee<\/fen> is going to work in for their <fen>Employer<\/fen>.",
        ],
      ],
      listRoleExamples: [
        [
          '<fex name="Empee">I<\/fex> was just fired yesterday!',
          "Dominic Mallozzi claims <fex name=\"Emper\">United Trust Bank<\/fex> fired him from a job at the bank's Palmer Township branch because he's HIV positive.",
          'Doc Rivers was fired <fex name="Posit">as coach of the Orlando Magic<\/fex>.',
          'I was fired <fex name="Task">from training the new actors<\/fex>.',
        ],
        [
          'Have <fex name="new">you<\/fex> signed up for the new Medicare Prescription program?',
          'Please join <fex name="gro">our club<\/fex>! CNI',
        ],
        [
          "",
          "",
          "",
          'Under the new program, SCC will accredit organizations <fex name="Function">to assess wood flow from certified forests to workshops or factories<\/fex>.',
          "",
        ],
        [
          'The police arrested Harry <fex name="Chrg">on charges of manslaughter<\/fex>.',
          '<fex name="Authorities">The police<\/fex> arrested Harry on charges of manslaughter.',
          'The police arrested <fex name="Suspect">Harry<\/fex> on charges of manslaughter.',
          'They arrested Harry <fex name="Offense">for shoplifting<\/fex>.',
        ],
        [
          '<fex name="Employee">I<\/fex> was just hired yesterday!',
          'Last month, <fex name="Emper">IBM<\/fex> hired Mike Zisman to head up its storage software group.',
          'I was hired <fex name="Task">just to empty the trash cans<\/fex>.',
          'Look, I wasn\'t hired <fex name="Posit">as your waitress<\/fex>!',
          'It\'s not easy to get hired <fex name="Field">in academia<\/fex>.',
        ],
      ],
    };
    initializeApp(data);
  }
});

function initializeApp(data) {
  var dataModel = new DataModel(data);
  var appView = new AppView({ model: dataModel });
  appView.render();
  $(document).on("keydown", function (e) {
    return appView.onKey(e);
  });
  $("#mturk_form").on("submit", function (e) {
    return appView.onSubmit(e);
  });
}

function getURLParameter(name) {
  var regex = new RegExp("[?|&]" + name + "=([^&;]+?)(&|#|;|$)");
  var matches = regex.exec(location.search);
  return matches ? decodeURIComponent(matches[1].replace(/\+/g, "%20")) : null;
}

function toggle_event_type() {
  var ele = document.getElementById("examples_event_type");
  var text = document.getElementById("displaytext_eventtype");
  if (ele.style.display != "none") {
    ele.style.display = "none";
    text.innerHTML = "(show)";
  } else {
    ele.style.display = "block";
    text.innerHTML = "(hide)";
  }
}

function toggle_role_passage() {
  var ele = document.getElementById("examples_roles_passage");
  var text = document.getElementById("displaytext_roles_passage");
  if (ele.style.display != "none") {
    ele.style.display = "none";
    text.innerHTML = "(show)";
  } else {
    ele.style.display = "block";
    text.innerHTML = "(hide)";
  }
}

function toggle_role_source() {
  var ele = document.getElementById("examples_roles_source");
  var text = document.getElementById("displaytext_roles_source");
  if (ele.style.display != "none") {
    ele.style.display = "none";
    text.innerHTML = "(show)";
  } else {
    ele.style.display = "block";
    text.innerHTML = "(hide)";
  }
}

function toggle_edge_cases() {
  var ele = document.getElementById("example_edge_cases");
  var text = document.getElementById("displaytext_edge_cases");
  if (ele.style.display != "none") {
    ele.style.display = "none";
    text.innerHTML = "(show)";
  } else {
    ele.style.display = "block";
    text.innerHTML = "(hide)";
  }
}

function toggle_general_rules() {
  var ele = document.getElementById("examples_general_rules");
  var text = document.getElementById("displaytext_general_rules");
  if (ele.style.display != "none") {
    ele.style.display = "none";
    text.innerHTML = "(show)";
  } else {
    ele.style.display = "block";
    text.innerHTML = "(hide)";
  }
}
