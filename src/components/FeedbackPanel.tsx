import React, { useState } from 'react';
import { AppSafeArea } from './AppSafeArea';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { DmzDialog } from './DmzDialog';
import { DmzIcon } from './DmzIcon';
import { DmzActionCard, DmzCard, DmzGoldButton } from './DmzSurface';
import { sendFeedback } from '../services/feedback';
import { colors, condensedFont, contentScaleFactor } from '../theme';
import type { ContentSize } from '../types';

const SUPPORT_DISCORD_URL = 'https://discord.gg/kdHneTZkyd';
const MAIN_DISCORD_URL = 'https://discord.gg/jTaTHqw45F';
const BETA_GROUP_URL = 'https://groups.google.com/g/dmz-ranked';

const CATEGORIES = [
  'App bug report',
  'App feature request',
  'App support',
  'Performance / loading',
  'WebView / website loading in app',
  'Other app feedback'
];

export function FeedbackPanel({
  visible,
  animations,
  contentSize,
  onClose
}: {
  visible: boolean;
  animations: boolean;
  contentSize: ContentSize;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [sending, setSending] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const submit = async () => {
    const cleanSubject = subject.trim();
    const cleanDetails = details.trim();
    if (cleanSubject.length < 3) {
      setSubjectError('Add a short subject.');
      return;
    }
    if (cleanDetails.length < 10) {
      setDetailsError('Please add more detail.');
      return;
    }

    setSending(true);
    const result = await sendFeedback({
      category,
      subject: cleanSubject,
      details: cleanDetails,
      contact: contact.trim()
    });
    setSending(false);

    if (result.ok) {
      setSubject('');
      setDetails('');
      setContact('');
      setResultTitle('REPORT SENT');
      setResultMessage(
        `Report ${result.reportId} sent. Thank you.`
      );
    } else {
      setResultTitle('FEEDBACK NOT SENT');
      setResultMessage(
        result.error ||
          'Could not send feedback. Use the App Support Discord instead.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={animations ? 'fade' : 'none'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <AppSafeArea contentScale={contentScaleFactor(contentSize)}>
        <View style={styles.toolbar}>
          <Pressable style={styles.back} onPress={onClose}>
            <DmzIcon name="back" size={24} />
          </Pressable>
          <Image
            source={require('../../assets/dmz_ranked_logo_display.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleWrap}>
            <Text style={styles.title}>APP FEEDBACK</Text>
            <Text style={styles.subtitle}>
              DMZ RANKED • UNOFFICIAL ANDROID CLIENT
            </Text>
          </View>
          <View style={styles.goldLine} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <DmzCard>
            <View style={styles.intro}>
              <Text style={styles.introTitle}>APP FEEDBACK &amp; SUPPORT</Text>
              <Text style={styles.copy}>
                Send feedback only for this unofficial Android app: app bugs,
                WebView/loading problems, app features, compatibility, and app
                support. The app team cannot change or fix the dmzranked.com
                website itself.
              </Text>
            </View>
          </DmzCard>

          <Text style={styles.section}>REPORT TYPE</Text>
          <Pressable onPress={() => setCategoryOpen(true)}>
            <DmzActionCard>
              <View style={styles.categoryCard}>
                <View style={styles.flex}>
                  <Text style={styles.category}>{category}</Text>
                  <Text style={styles.categoryHint}>Tap to change report type</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </DmzActionCard>
          </Pressable>

          <View style={styles.inputGap}>
            <DmzActionCard>
              <TextInput
                value={subject}
                onChangeText={value => {
                  setSubject(value);
                  setSubjectError('');
                }}
                placeholder="Short title / subject"
                placeholderTextColor={colors.muted}
                style={styles.input}
                maxLength={180}
              />
            </DmzActionCard>
            {subjectError ? (
              <Text style={styles.error}>{subjectError}</Text>
            ) : null}
          </View>

          <View style={styles.inputGap}>
            <DmzActionCard>
              <TextInput
                value={details}
                onChangeText={value => {
                  setDetails(value);
                  setDetailsError('');
                }}
                placeholder="Describe what happened in the Android app, what you expected, or what app feature you want…"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.details]}
                multiline
                textAlignVertical="top"
                maxLength={3500}
              />
            </DmzActionCard>
            {detailsError ? (
              <Text style={styles.error}>{detailsError}</Text>
            ) : null}
          </View>

          <View style={styles.inputGap}>
            <DmzActionCard>
              <TextInput
                value={contact}
                onChangeText={setContact}
                placeholder="Discord username (optional)"
                placeholderTextColor={colors.muted}
                style={styles.input}
                maxLength={300}
                autoCapitalize="none"
              />
            </DmzActionCard>
          </View>

          <Text style={styles.scope}>
            APP ONLY • Website content, rankings, rules, operator data, or
            server-side problems are controlled by DMZ Ranked, not this Android
            client.
          </Text>

          <Text style={styles.privacy}>
            The report automatically includes app version, Android version, and
            device model so app issues can be diagnosed. Do not include
            passwords, PINs, account tokens, cookies, or other private
            credentials.
          </Text>

          <View style={styles.sendGap}>
            <Pressable disabled={sending} onPress={() => void submit()}>
              <DmzGoldButton>
                <View style={styles.sendButton}>
                  <Text style={styles.sendText}>
                    {sending ? 'SENDING…' : 'SEND TO APP TEAM'}
                  </Text>
                </View>
              </DmzGoldButton>
            </Pressable>
          </View>

          <Text style={styles.section}>APP SUPPORT ZONE</Text>
          <SupportButton
            title="App Support Discord"
            onPress={() => void Linking.openURL(SUPPORT_DISCORD_URL)}
          />
          <SupportButton
            title="Join App Beta Group"
            onPress={() => void Linking.openURL(BETA_GROUP_URL)}
          />
          <Text style={styles.note}>
            Use this zone for the unofficial app, WebView, loading, appearance,
            notifications, widgets, compatibility, or app-only features.
          </Text>

          <Text style={styles.section}>WEBSITE SUPPORT ZONE</Text>
          <DmzCard>
            <View style={styles.intro}>
              <Text style={styles.introTitle}>DMZRANKED.COM SUPPORT</Text>
              <Text style={styles.copy}>
                Website rankings, rules, raid/operator data, moderation,
                accounts, and server-side behavior are controlled by the DMZ
                Ranked website team.
              </Text>
            </View>
          </DmzCard>
          <SupportButton
            title="Main DMZ Ranked Discord"
            onPress={() => void Linking.openURL(MAIN_DISCORD_URL)}
          />
        </ScrollView>

        <DmzDialog
          visible={categoryOpen}
          title="REPORT TYPE"
          message="Choose the type of app feedback."
          negativeLabel="CANCEL"
          animations={animations}
          contentScale={contentScaleFactor(contentSize)}
          operatorPicker
          choices={CATEGORIES.map(item => ({
            label: item,
            selected: item === category,
            onPress: () => {
              setCategory(item);
              setCategoryOpen(false);
            }
          }))}
          onNegative={() => setCategoryOpen(false)}
        />

        <DmzDialog
          visible={Boolean(resultTitle)}
          title={resultTitle}
          message={resultMessage}
          positiveLabel="OK"
          animations={animations}
          contentScale={contentScaleFactor(contentSize)}
          onPositive={() => {
            setResultTitle('');
            setResultMessage('');
          }}
        />
      </AppSafeArea>
    </Modal>
  );
}

function SupportButton({
  title,
  onPress
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.supportGap}>
      <Pressable onPress={onPress}>
        <DmzActionCard>
          <View style={styles.supportButton}>
            <Text style={styles.supportText}>{title}</Text>
            <Text style={styles.supportArrow}>↗</Text>
          </View>
        </DmzActionCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  toolbar: {
    height: 64,
    backgroundColor: colors.toolbar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 12
  },
  goldLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.gold
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: { width: 42, height: 42 },
  titleWrap: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  title: {
    color: colors.white,
    fontFamily: condensedFont,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 1.8
  },
  subtitle: {
    color: colors.goldSoft,
    fontFamily: condensedFont,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28
  },
  intro: { padding: 16 },
  introTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900'
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  section: {
    color: colors.gold,
    fontFamily: condensedFont,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginLeft: 4,
    marginTop: 22,
    marginBottom: 10
  },
  categoryCard: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  flex: { flex: 1 },
  category: { color: colors.white, fontSize: 16, fontWeight: '800' },
  categoryHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  chevron: { color: colors.gold, fontSize: 26 },
  inputGap: { marginTop: 10 },
  input: {
    minHeight: 50,
    color: colors.white,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  details: { minHeight: 150 },
  error: { color: colors.red, fontSize: 11, marginTop: 4, marginLeft: 4 },
  scope: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: 12
  },
  privacy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: 12
  },
  sendGap: { marginTop: 16 },
  sendButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '900'
  },
  supportGap: { marginBottom: 10 },
  supportButton: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  supportText: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: '800'
  },
  supportArrow: { color: colors.gold, fontSize: 18 },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: 10
  }
});
